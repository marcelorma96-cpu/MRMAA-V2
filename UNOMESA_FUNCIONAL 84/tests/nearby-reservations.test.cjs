const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { createClient } = require('@supabase/supabase-js');
function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  Function('module', 'exports', 'require', code)(module, module.exports, name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name));
  return module.exports;
}
const { readNearbyReservations: read, readReservationWarning, reservationWarningWindowLabel } = load('lib/nearby-reservations.ts');
const rid = '33333333-3333-4333-8333-333333333333', other = '44444444-4444-4444-8444-444444444444';
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const a = id(800), b = id(801), areas = [{ id: a, name: 'Salón 1' }, { id: b, name: 'Terraza' }];

async function fixture({ legacy = false, fail } = {}) {
  const db = new PGlite(), requests = [];
  await db.exec(`create table v2_reservations(id uuid primary key,restaurant_id uuid,client_name text,event_date date,event_time time,guests int,area text,area_id uuid,${legacy ? '' : 'area_ids uuid[],'}status text,deleted_at timestamptz);
    create role authenticated; grant usage on schema public to authenticated; grant select on v2_reservations to authenticated;
    alter table v2_reservations enable row level security;
    create policy readable on v2_reservations for select to authenticated using (restaurant_id='${rid}');`);
  async function add(n, extra = {}) {
    const row = { id: id(n), restaurant_id: rid, client_name: `Reserva ${n}`, event_date: '2026-11-01', event_time: '13:00', guests: 4, area: 'Salón 1', area_id: a, status: 'pendiente', deleted_at: null, ...extra };
    const keys = Object.keys(row), values = Object.values(row).map(value => Array.isArray(value) ? `{${value.join(',')}}` : value);
    await db.query(`insert into v2_reservations(${keys.join(',')}) values(${keys.map((_, i) => '$' + (i + 1)).join(',')})`, values);
  }
  const client = createClient('https://fixture.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(input); requests.push(url);
    assert.equal(url.pathname, '/rest/v1/v2_reservations');
    if (fail) return new Response(JSON.stringify(fail), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const params = url.searchParams, columns = params.get('select');
    assert(/^[a-z_,]+$/.test(columns)); assert.equal(params.get('order'), 'id.asc'); assert.equal(params.get('limit'), '250');
    assert.equal(params.has('status'), false, 'pending reservations must not be filtered out');
    const where = [], values = [];
    for (const [key, value] of params) {
      if (['select', 'order', 'limit'].includes(key)) continue;
      assert(['restaurant_id', 'event_date', 'event_time', 'deleted_at', 'id'].includes(key));
      const at = value.indexOf('.'), op = value.slice(0, at), operand = value.slice(at + 1);
      if (op === 'is') { assert.equal(operand, 'null'); where.push(key + ' is null'); continue; }
      const operator = { eq: '=', neq: '<>', gt: '>', gte: '>=', lte: '<=' }[op]; assert(operator);
      values.push(operand); where.push(`${key} ${operator} $${values.length}`);
    }
    try {
      await db.exec('set role authenticated');
      const result = await db.query(`select ${columns} from v2_reservations where ${where.join(' and ')} order by id limit 250`, values);
      return new Response(JSON.stringify(result.rows.map(row => ({ ...row, event_date: row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : String(row.event_date).slice(0, 10) }))), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ code: error.code, message: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    } finally { await db.exec('reset role'); }
  } } });
  return { db, client, add, requests };
}

test('pending and confirmed bookings warn within the inclusive three-hour window; canceled, trash, other days/areas/tenants and self do not', async () => {
  const f = await fixture(); try {
    const statuses = ['pendiente', 'pending', ' Pendiente ', 'confirmada', 'confirmed', null, ''];
    for (let i = 0; i < statuses.length; i++) await f.add(i + 1, { status: statuses[i] });
    for (const [i, status] of ['cancelada', ' Cancelado ', 'cancelled', 'canceled'].entries()) await f.add(20 + i, { status });
    await f.add(30, { area: 'Salón 2', area_id: b });
    await f.add(31, { event_date: '2026-11-02' });
    await f.add(32, { restaurant_id: other });
    await f.add(33, { deleted_at: '2026-11-01T01:00:00Z' });
    await f.add(34, { event_time: null });
    await f.add(40, { event_time: '10:00' }); await f.add(41, { event_time: '16:00' });
    await f.add(42, { event_time: '09:59:59' }); await f.add(43, { event_time: '16:00:00.000001' });
    const before = (await f.db.query('select * from v2_reservations order by id')).rows;
    const rows = await read(f.client, rid, [areas[0]], '2026-11-01', '13:00', id(1));
    assert.deepEqual(rows.map(row => row.id), [id(40), ...[2, 3, 4, 5, 6, 7].map(id), id(41)]);
    assert.equal(rows[1].status, 'pending');
    assert.deepEqual((await f.db.query('select * from v2_reservations order by id')).rows, before);
    assert.deepEqual(await read(f.client, other, [areas[0]], '2026-11-01', '13:00'), []);
  } finally { await f.db.close(); }
});

test('matches secondary areas and historical names without confusing room numbers or duplicating a reservation', async () => {
  const f = await fixture(); try {
    await f.add(1, { area: 'Salón 1 + Terraza', area_ids: [a, b] });
    await f.add(2, { area: '  SALON   1 ', area_id: null });
    await f.add(3, { area: 'Nombre anterior', area_id: a });
    await f.add(4, { area: 'Salón 2', area_id: id(802) });
    assert.deepEqual((await read(f.client, rid, [areas[1]], '2026-11-01', '13:00')).map(row => row.id), [id(1)]);
    assert.deepEqual((await read(f.client, rid, areas, '2026-11-01', '13:00')).map(row => row.id), [id(1), id(2), id(3)]);
  } finally { await f.db.close(); }
});

test('a pending booking beyond the first page is found even when earlier rows belong to a different area', async () => {
  const f = await fixture(); try {
    await f.db.exec(`insert into v2_reservations(id,restaurant_id,client_name,event_date,event_time,area,area_id,status)
      select ('11111111-1111-4111-8111-'||lpad(n::text,12,'0'))::uuid,'${rid}','Otra','2026-11-01','13:00','Terraza','${b}','pendiente' from generate_series(1,251) n;`);
    await f.add(300);
    assert.deepEqual((await read(f.client, rid, [areas[0]], '2026-11-01', '13:00')).map(row => row.id), [id(300)]);
    assert.equal(f.requests.length, 2); assert.equal(f.requests[1].searchParams.get('id'), 'gt.' + id(250));
  } finally { await f.db.close(); }
});

test('legacy single-area installations still include pending bookings without using an older RPC', async () => {
  const f = await fixture({ legacy: true }); try {
    await f.add(1);
    assert.equal((await read(f.client, rid, [areas[0]], '2026-11-01', '13:00')).length, 1);
    assert.equal(f.requests.length, 2);
    assert(f.requests[0].searchParams.get('select').includes('area_ids'));
    assert(!f.requests[1].searchParams.get('select').includes('area_ids'));
  } finally { await f.db.close(); }
});

test('early/late times stay on the selected day and preserve the exact time boundary', async () => {
  const f = await fixture(); try {
    await f.add(1, { event_time: '00:00' }); await f.add(2, { event_time: '04:15:30' });
    await f.add(3, { event_time: '04:15:30.000001' }); await f.add(4, { event_time: '23:59:59.999999' });
    await f.add(5, { event_time: '23:00', event_date: '2026-10-31' });
    assert.deepEqual((await read(f.client, rid, [areas[0]], '2026-11-01', '01:15:30')).map(row => row.id), [id(1), id(2)]);
    assert.deepEqual((await read(f.client, rid, [areas[0]], '2026-11-01', '23:00')).map(row => row.id), [id(4)]);
  } finally { await f.db.close(); }
});

test('permissions and other read errors stop the check rather than pretending no conflicts exist', async () => {
  const f = await fixture({ fail: { code: '42501', message: 'permission denied' } }); try {
    await assert.rejects(read(f.client, rid, [areas[0]], '2026-11-01', '13:00'), error => error.code === '42501');
    assert.equal(f.requests.length, 1);
    await assert.rejects(read(f.client, rid, [areas[0]], '2026-11-01', '25:00'));
    assert.equal(f.requests.length, 1);
  } finally { await f.db.close(); }
});

test('the form waits for the overlap decision and preserves review/cancel behavior for pending reservations', async () => {
  const source = fs.readFileSync('components/dashboard.tsx', 'utf8');
  const body = source.slice(source.indexOf('  async function checkNearby('), source.indexOf('  const clientDraft ='));
  const code = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const decision of [true, false]) {
    const pending = { id: id(1), status: 'pendiente' }, warningAnswer = { current: null }, seen = [];
    const context = { areas, selectedArea: () => areas[0], setError: error => { throw Error(error); },
      readReservationWarning: async () => ({reservations:[pending],windowMinutes:120}),setNearbyWindowMinutes: value=>assert.equal(value,120),supabase: {}, restaurantId: rid,
      setNearby: rows => seen.push(rows), warningAnswer, userMessage: String };
    const check = Function(...Object.keys(context), code + '; return checkNearby;')(...Object.values(context));
    const result = check('Salón 1', a, '2026-11-01', '13:00');
    await Promise.resolve(); assert.deepEqual(seen, [[pending]]); assert.equal(typeof warningAnswer.current, 'function');
    warningAnswer.current(decision); assert.equal(await result, decision ? 'confirmed' : false);
  }
});

test('the warning follows the saved restaurant duration, reloads changes, and uses three hours only as its default', async () => {
  const f = await fixture(); try {
    await f.add(1, { event_time: '09:00' }); await f.add(2, { event_time: '11:00' });
    await f.add(3, { event_time: '14:30' }); await f.add(4, { event_time: '17:00' });
    let savedMinutes = 120, reads = 0;
    f.client.rpc = async (name, args) => {
      assert.equal(name, 'v2_floor_read'); assert.deepEqual(args, { p_restaurant_id: rid, p_date: '2026-11-01' });
      reads++; return { data: { layout: { areas: [], tables: [], defaultDurationMinutes: savedMinutes } }, error: null };
    };
    let warning = await readReservationWarning(f.client, rid, [areas[0]], '2026-11-01', '13:00');
    assert.equal(warning.windowMinutes, 120); assert.deepEqual(warning.reservations.map(row => row.id), [id(2), id(3)]);
    savedMinutes = 240;
    warning = await readReservationWarning(f.client, rid, [areas[0]], '2026-11-01', '13:00');
    assert.equal(warning.windowMinutes, 240); assert.deepEqual(warning.reservations.map(row => row.id), [1, 2, 3, 4].map(id));
    savedMinutes = 90;
    warning = await readReservationWarning(f.client, rid, [areas[0]], '2026-11-01', '13:00');
    assert.equal(warning.windowMinutes, 90); assert.deepEqual(warning.reservations.map(row => row.id), [id(3)]);
    savedMinutes = undefined;
    warning = await readReservationWarning(f.client, rid, [areas[0]], '2026-11-01', '13:00');
    assert.equal(warning.windowMinutes, 180); assert.deepEqual(warning.reservations.map(row => row.id), [id(2), id(3)]);
    assert.equal(reads, 4);
    assert.equal(reservationWarningWindowLabel(90), '1 h 30 min');
    assert.equal(reservationWarningWindowLabel(180), '3 h');
    assert.equal(reservationWarningWindowLabel(15), '15 min');
  } finally { await f.db.close(); }
});

test('missing legacy settings use the default; a settings permission failure never silently assumes three hours', async () => {
  const f = await fixture(); try {
    await f.add(1);
    f.client.rpc = async () => ({ error: { code: 'PGRST202', message: 'Could not find public.v2_floor_read' }, data: null });
    assert.equal((await readReservationWarning(f.client, rid, [areas[0]], '2026-11-01', '13:00')).windowMinutes, 180);
    const count = f.requests.length;
    f.client.rpc = async () => ({ error: { code: 'P0001', message: 'FLOOR_ACCESS' }, data: null });
    await assert.rejects(readReservationWarning(f.client, rid, [areas[0]], '2026-11-01', '13:00'), error => error.message === 'FLOOR_ACCESS');
    assert.equal(f.requests.length, count);
  } finally { await f.db.close(); }
});
