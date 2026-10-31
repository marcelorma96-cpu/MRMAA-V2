const {test} = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
const {NextRequest, NextResponse} = require('next/server');
const rid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cleanup = load('lib/tenant-storage-cleanup.ts').removeTenantFiles;

function storageFixture() {
  const buckets = new Map(), calls = [];
  for (const bucket of ['mrmaa-branding', 'unomesa-public']) {
    const files = new Set([other + '/keep.pdf', rid + '/logo.png']);
    for (let i = 0; i < 205; i++) files.add(rid + '/menus/nested/' + i + '.pdf');
    buckets.set(bucket, files);
  }
  return {buckets, calls, admin: {storage: {from(bucket) { return {
    async list(prefix, {limit}) {
      calls.push({bucket, prefix});
      const children = new Map();
      for (const path of buckets.get(bucket)) {
        if (!path.startsWith(prefix + '/')) continue;
        const rest = path.slice(prefix.length + 1), name = rest.split('/')[0];
        children.set(name, {name, id: rest.includes('/') ? null : path});
      }
      return {data: [...children.values()].slice(0, limit), error: null};
    },
    async remove(paths) {
      for (const path of paths) { assert(path.startsWith(rid + '/')); buckets.get(bucket).delete(path); }
      return {error: null};
    }
  };}}}};
}
test('tenant cleanup traverses nested folders and pages in both buckets, preserving another tenant', async () => {
  const f = storageFixture(); await cleanup(f.admin, rid, Date.now() + 5000);
  for (const files of f.buckets.values()) assert.deepEqual([...files], [other + '/keep.pdf']);
  assert(f.calls.length > 6);
});
test('tenant cleanup rejects unsafe prefixes and paths before deleting anything', async () => {
  const f = storageFixture();
  await assert.rejects(cleanup(f.admin, rid + '/../' + other, Date.now() + 5000), /CLEANUP_PAYLOAD/);
  assert.equal(f.calls.length, 0);
  let deleted = false;
  const admin = {storage: {from: () => ({list: async () => ({data: [{id: 'x', name: '../other.pdf'}]}),
    remove: async () => {deleted = true; return {};}})}};
  await assert.rejects(cleanup(admin, rid, Date.now() + 5000), /STORAGE_PATH_INVALID/);
  assert.equal(deleted, false);
});
test('cleanup stops on timeout, failed deletion and exhausted work budget without claiming completion', async () => {
  const f = storageFixture();
  await assert.rejects(cleanup(f.admin, rid, Date.now() - 1), /CLEANUP_RETRY/);
  assert.equal(f.calls.length, 0);
  let reads = 0;
  const make = error => ({storage: {from: () => ({list: async () => {
    reads++; return {data: [{id: 'x', name: 'logo.png'}]};
  }, remove: async () => ({error})})}});
  await assert.rejects(cleanup(make(new Error('offline')), rid, Date.now() + 5000), /STORAGE_DELETE_FAILED/);
  reads = 0;
  await assert.rejects(cleanup(make(null), rid, Date.now() + 5000), /CLEANUP_RETRY/);
  assert.equal(reads, 50);
});

function accountFixture({count = 1, countError = null, role = 'administrador', owns = false} = {}) {
  const events = [], user = {id: 'user'}, member = {restaurant_id: rid, role, status: 'activo'};
  const admin = {from(table) {
    let mode = 'select', head = false;
    const q = {select(_fields, options) {head = options?.head; return q;}, eq() {return q;}, limit() {return q;},
      delete() {mode = 'delete'; return q;}, maybeSingle() {return Promise.resolve({data: member});},
      then(resolve, reject) {
        let result = {data: []};
        if (table === 'v2_restaurants') result = {data: owns ? [{id: rid}] : []};
        if (mode === 'delete') events.push('membership-delete');
        if (head) result = {data: null, count, error: countError};
        return Promise.resolve(result).then(resolve, reject);
      }}; return q;
  }, auth: {admin: {deleteUser: async () => {events.push('auth-delete'); return {};}}}};
  const client = {auth: {getUser: async () => ({data: {user}})}};
  let created = 0;
  const route = load('app/api/account/route.ts', {
    'next/server': {NextResponse},
    '@/lib/user-message': {userMessage: e => e.message},
    '@/lib/mfa': {requireVerifiedMfa: async () => {}},
    '@/lib/site-origin': {siteOrigin: () => 'https://www.unomesa.com'},
    '@/lib/permissions': {permissionsFor: r => ({isAdmin: r === 'administrador'})},
    '@/lib/server-scale': {takeDistributedRateLimit: async () => {}, readBoundedJson: r => r.json(), RequestSafetyError: class extends Error {}},
    '@supabase/supabase-js': {createClient: () => ++created === 1 ? client : admin}
  }, {process: {env: {NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture', SUPABASE_SERVICE_ROLE_KEY: 'fixture'}}});
  return {events, run: () => route.POST(new NextRequest('https://www.unomesa.com/api/account', {
    method: 'POST', headers: {authorization: 'Bearer fixture', 'content-type': 'application/json', 'x-unomesa-restaurant': rid},
    body: JSON.stringify({action: 'delete_account', confirmation: 'ELIMINAR MRMAA'})
  }))};
}
test('account deletion preserves shared identity while another restaurant membership remains', async () => {
  const f = accountFixture({count: 1}); assert.equal((await f.run()).status, 200);
  assert.deepEqual(f.events, ['membership-delete']);
});
test('account deletion never deletes Auth identity when membership count is unknown or failed', async () => {
  for (const options of [{count: null}, {count: null, countError: {message: 'offline'}}]) {
    const f = accountFixture(options); assert.equal((await f.run()).status, 400);
    assert(!f.events.includes('auth-delete'));
  }
});
test('account deletion removes Auth identity only on confirmed zero memberships; owner and nonadmin blocked', async () => {
  const f = accountFixture({count: 0}); assert.equal((await f.run()).status, 200);
  assert.deepEqual(f.events, ['membership-delete', 'auth-delete']);
  for (const options of [{owns: true}, {role: 'lectura'}]) {
    const blocked = accountFixture(options); assert.equal((await blocked.run()).status, 400);
    assert.deepEqual(blocked.events, []);
  }
});

function reconcileFixture() {
  const now = Date.now(), hour = 3600000, queries = [], writes = [], rows = [];
  for (const provider of ['apple', 'google_play']) for (const mode of ['live', 'test']) {
    for (let i = 0; i < 6; i++) rows.push({provider, mode, restaurant_id: provider + i,
      external_id: provider + mode + i, purchase_reference: provider + i, checked_at: new Date(now - 7 * hour).toISOString()});
  }
  const admin = {from() {
    const filters = [], orders = []; let update = null, limit = Infinity;
    const q = {select() {return q;}, eq(k, v) {filters.push([k, v]); return q;},
      or() {return q;}, lt(k, v) {filters.push(['cutoff', v]); return q;},
      order(k) {orders.push(k); return q;}, limit(n) {limit = n; return q;}, update(v) {update = v; return q;},
      then(resolve, reject) {
        if (update) {
          writes.push({filters, update});
          for (const row of rows) if (filters.every(([k, v]) => row[k] === v)) Object.assign(row, update);
          return Promise.resolve({error: null}).then(resolve, reject);
        }
        queries.push({filters, orders, limit});
        return Promise.resolve({data: rows.filter(row => filters.every(([k, v]) => k === 'cutoff' ? row.checked_at < v : row[k] === v)).slice(0, limit).map(row => ({...row})), error: null}).then(resolve, reject);
      }}; return q;
  }};
  return {now, hour, rows, queries, writes, admin};
}
const reconciler = load('lib/store-reconcile-worker.ts');
test('store worker isolates provider/mode, bounds concurrency, interleaves providers and retries unchanged failures sooner', async () => {
  const f = reconcileFixture(), started = []; let running = 0, peak = 0;
  const result = await reconciler.runStoreReconciliation(f.admin, [{provider: 'apple', mode: 'live'}, {provider: 'google_play', mode: 'test'}],
    async (_admin, restaurant, provider) => {
      started.push(provider); running++; peak = Math.max(peak, running);
      await new Promise(r => setImmediate(r)); running--;
      if (restaurant === 'apple0') throw new Error('provider outage');
    }, Date.now() + 5000);
  assert.equal(result.checked, 11); assert.equal(result.failed, 1); assert.equal(result.deferred, 0);
  assert.equal(peak, 4); assert.deepEqual(started.slice(0, 4), ['apple', 'google_play', 'apple', 'google_play']);
  assert(f.queries.every(q => q.limit === 50));
  const failure = f.rows.find(r => r.external_id === 'applelive0');
  const nextEligible = Date.parse(failure.checked_at) + reconciler.STORE_RECHECK_MS;
  assert(Math.abs(nextEligible - (Date.now() + 10 * 60000)) < 1500);
  for (const row of f.rows.filter(r => r.provider === 'apple' && r.mode === 'test')) assert.equal(Date.parse(row.checked_at), f.now - 7 * f.hour);
});
test('store worker preserves fresher webhook verification with compare-and-set', async () => {
  const f = reconcileFixture(), fresh = new Date(f.now + 60000).toISOString();
  await reconciler.runStoreReconciliation(f.admin, [{provider: 'apple', mode: 'live'}], async (_admin, restaurant) => {
    if (restaurant === 'apple0') { f.rows.find(r => r.external_id === 'applelive0').checked_at = fresh; throw new Error('late failure'); }
  }, Date.now() + 5000);
  assert.equal(f.rows.find(r => r.external_id === 'applelive0').checked_at, fresh);
  assert(f.writes.every(w => w.filters.some(([key]) => key === 'checked_at')));
});
test('store worker stops before starting overdue work and rejects unavailable queue', async () => {
  const f = reconcileFixture(); let calls = 0;
  const r = await reconciler.runStoreReconciliation(f.admin, [{provider: 'apple', mode: 'live'}], async () => {calls++;}, Date.now() - 1);
  assert.equal(calls, 0); assert.equal(r.deferred, 6);
  const bad = {from() { const q = {select: () => q, eq: () => q, or: () => q, lt: () => q, order: () => q, limit: () => q,
    then: resolve => resolve({error: new Error('offline')})}; return q; }};
  await assert.rejects(reconciler.runStoreReconciliation(bad, [{provider: 'apple', mode: 'live'}], async () => {}, Date.now() + 5000), /RECONCILIATION_UNAVAILABLE/);
});
