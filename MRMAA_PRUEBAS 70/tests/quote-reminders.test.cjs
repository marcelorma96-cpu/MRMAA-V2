const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function load(file, cache = {}) {
  file = path.resolve(file);
  if (cache[file]) return cache[file].exports;
  const module = { exports: {} }; cache[file] = module;
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Date, AbortController, require: name =>
    name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts'), cache) : require(name) });
  return module.exports;
}
const { readUpcomingQuotePage, readDismissedQuoteCount, restoreDismissedQuoteReminders, dismissQuoteReminder } = load('lib/quote-data.ts');
const { localTimestampDate, localTimestampTime, formatEventTime } = load('lib/local-date.ts');

// Run the actual reader's filters and writes against PostgreSQL, with real pagination.
function clientFor(db, writes = []) {
  return { from(table) {
    assert.equal(table, 'v2_quotes');
    const values = [], filters = [], order = [];
    let columns = '*', count = false, first = 0, size = 50, update, signal;
    const bind = value => { values.push(value); return '$' + values.length; };
    const builder = {
      select(value, options) { columns = value; count = options?.count === 'exact'; return this; },
      eq(key, value) { filters.push(`${key} = ${bind(value)}`); return this; },
      in(key, list) { filters.push(`${key} in (${list.map(bind).join(',')})`); return this; },
      or(value) { assert.equal(value, 'reminder_dismissed.eq.false,reminder_dismissed.is.null'); filters.push('(reminder_dismissed = false or reminder_dismissed is null)'); return this; },
      is(key, value) { assert.equal(value, null); filters.push(`${key} is null`); return this; },
      gte(key, value) { filters.push(`${key} >= ${bind(value)}`); return this; },
      lte(key, value) { filters.push(`${key} <= ${bind(value)}`); return this; },
      order(key) { order.push(key); return this; },
      range(start, end) { first = start; size = end - start + 1; return this; },
      abortSignal(value) { signal = value; return this; },
      update(value) { update = value; return this; },
      async then(resolve, reject) {
        try {
          signal?.throwIfAborted();
          const where = filters.length ? ' where ' + filters.join(' and ') : '';
          let result;
          if (update) {
            assert.deepEqual(Object.keys(update), ['reminder_dismissed']);
            writes.push(update.reminder_dismissed);
            const assignments = Object.entries(update).map(([key, value]) => `${key} = ${bind(value)}`).join(',');
            result = await db.query(`update ${table} set ${assignments}${where} returning ${columns}`, values);
          } else {
            result = await db.query(`select ${columns} from ${table}${where}${order.length ? ' order by ' + order.join(',') : ''} limit ${size} offset ${first}`, values);
          }
          const total = count ? (await db.query(`select count(*)::int n from ${table}${where}`, values)).rows[0].n : null;
          resolve({ data: result.rows, count: total, error: null });
        } catch (error) { reject(error); }
      },
    };
    return builder;
  } };
}

test('installed schema: explicit recovery and removal only change the existing flag', async () => {
  const db = new PGlite();
  const ours = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
  const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
  try {
    // Exact names and types from the supplied v2_quotes schema export. No migration.
    await db.exec(`create table v2_quotes (
      id uuid primary key, restaurant_id uuid, client_id uuid, quote_number integer,
      client_name text, client_phone text, client_email text, event_date date, event_time time,
      area text, guests integer, discount_pct numeric, tip_pct numeric, subtotal numeric,
      total numeric, deposit numeric, balance numeric, customer_note text, internal_notes text,
      status text, created_at timestamptz default '2026-09-30T06:25:00Z',
      updated_at timestamptz default '2026-09-30T06:25:00Z', deleted_at timestamptz, deleted_by uuid,
      custom_fields jsonb default '{"client_reference":"KEEP"}', adjustments jsonb,
      payment_method text, area_id uuid, client_request_id uuid,
      reminder_dismissed boolean default false
    );
    insert into v2_quotes(id,restaurant_id,quote_number,client_name,event_date,event_time,area,total,status,reminder_dismissed) values
      ('${id(1)}','${ours}',1,'Previously hidden','2026-09-30','19:30','Salón',250,'pendiente',true),
      ('${id(2)}','${ours}',2,'Visible','2026-10-05','19:30','Salón',500,'pendiente',false),
      ('${id(3)}','${other}',3,'Other restaurant','2026-09-30','19:30','Salón',750,'pendiente',true),
      ('${id(4)}','${ours}',4,'Yesterday','2026-09-29','19:30','Salón',100,'pendiente',true),
      ('${id(5)}','${ours}',5,'Later','2026-10-06','19:30','Salón',100,'pendiente',true),
      ('${id(6)}','${ours}',6,'Converted','2026-09-30','19:30','Salón',100,'convertida',true),
      ('${id(7)}','${ours}',7,'Confirmed','2026-09-30','19:30','Salón',100,'confirmada',false),
      ('${id(8)}','${ours}',8,'Trash','2026-09-30','19:30','Salón',100,'pendiente',true),
      ('${id(9)}','${ours}',9,'No previous flag','2026-09-30','19:30','Salón',100,'pendiente',null);
    update v2_quotes set deleted_at=now() where id='${id(8)}';`);
    const schemaQuery = "select column_name,data_type from information_schema.columns where table_schema='public' and table_name='v2_quotes' order by ordinal_position";
    const schema = (await db.query(schemaQuery)).rows;
    assert.equal(schema.length, 30);
    const before = (await db.query('select * from v2_quotes order by id')).rows;
    const writes = [], client = clientFor(db, writes), signal = new AbortController().signal;
    const read = (page = 1) => readUpcomingQuotePage(client, ours, '2026-09-30', page, signal);
    const hiddenCount = () => readDismissedQuoteCount(client, ours, '2026-09-30', signal);
    const restore = () => restoreDismissedQuoteReminders(client, ours, '2026-09-30');
    assert.deepEqual((await read()).rows.map(q => q.id), [id(9), id(2)]);
    assert.equal((await read()).total, 2);
    assert.equal(await hiddenCount(), 1);
    assert.equal(writes.length, 0);
    assert.deepEqual((await db.query('select * from v2_quotes order by id')).rows, before);
    assert.equal(await restore(), 1);
    assert.equal(await hiddenCount(), 0);
    assert.equal((await read()).total, 3);
    const legacy = (await read()).rows[0];
    assert.equal(legacy.id, id(1));
    await assert.rejects(dismissQuoteReminder(client, other, legacy), /cambió/);
    await assert.rejects(dismissQuoteReminder(client, ours, { ...legacy, event_date: '2026-10-01' }), /cambió/);
    await dismissQuoteReminder(client, ours, legacy);
    assert.equal((await read()).total, 2);
    // A second client sees the saved removal, with no browser-local workaround.
    assert.equal((await readUpcomingQuotePage(clientFor(db), ours, '2026-09-30', 1, signal)).total, 2);
    const removed = (await db.query('select * from v2_quotes where id=$1', [id(1)])).rows[0];
    assert.equal(removed.reminder_dismissed, true);
    assert.equal(removed.status, 'pendiente');
    assert.equal(removed.total, '250');
    assert.equal(removed.deleted_at, null);
    assert.equal((await db.query('select count(*)::int n from v2_quotes')).rows[0].n, 9);
    assert.deepEqual((await db.query('select * from v2_quotes order by id')).rows, before);
    assert.equal(await restore(), 1);
    const omitFlag = ({ reminder_dismissed, ...record }) => record;
    assert.deepEqual((await db.query('select * from v2_quotes order by id')).rows.map(omitFlag), before.map(omitFlag));
    assert.equal((await db.query('select reminder_dismissed from v2_quotes where id=$1', [id(3)])).rows[0].reminder_dismissed, true);
    await db.exec(`insert into v2_quotes(id,restaurant_id,quote_number,client_name,event_date,status,reminder_dismissed)
      select ('00000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,'${ours}',100+n,'Bulk '||n,'2026-10-02','pendiente',true from generate_series(1,51) n`);
    assert.equal(await hiddenCount(), 51);
    assert.equal(await restore(), 50);
    assert.equal(await hiddenCount(), 1);
    assert.equal((await read()).total, 53);
    assert.equal((await read()).rows.length, 50);
    assert.equal((await read(2)).rows.length, 3);
    const ids = [...(await read()).rows, ...(await read(2)).rows].map(q => q.id);
    assert.equal(new Set(ids).size, 53);
    assert.equal(await restore(), 1);
    assert.equal(await hiddenCount(), 0);
    const writeCount = writes.length;
    assert.equal(await restore(), 0);
    assert.equal(writes.length, writeCount);
    assert.deepEqual((await db.query(schemaQuery)).rows, schema);
  } finally { await db.close(); }
});

test('creation time follows device zone and 12/24-hour preference; event time stays fixed', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Guatemala';
    assert.equal(localTimestampDate('2026-09-30T04:09:00Z'), '2026-09-29');
    assert.equal(localTimestampTime('2026-09-30T04:09:00Z', '24h'), '22:09');
    assert.equal(localTimestampTime('2026-09-30T04:09:00Z', '12h'), '10:09 PM');
    assert.equal(localTimestampTime('2026-09-30T06:00:00Z', '12h'), '12:00 AM');
    assert.equal(localTimestampTime('2026-09-30T18:00:00Z', '12h'), '12:00 PM');
    process.env.TZ = 'UTC';
    assert.equal(localTimestampDate('2026-09-30T04:09:00Z'), '2026-09-30');
    assert.equal(localTimestampTime('2026-09-30T04:09:00Z', '24h'), '04:09');
    assert.equal(formatEventTime('19:30', '24h'), '19:30');
    for (const missing of [null, undefined, '', 'invalid']) assert.equal(localTimestampTime(missing), null);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
