const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { setup, a } = require('./helpers/event-area-database.cjs');
const { database, rpc, save, quote, snapshot, rid, id, floor, payload, expected } = require('./helpers/floor-database.cjs');

// Exercise the installed SQL functions against a local database. No production
// credentials or services are used. M1 and M2 below belong to the same room.
async function sameRoom() {
  const db = await setup();
  const current = await rpc(db, 'v2_floor_read', [rid, '2026-09-30']);
  current.layout.tables.push({ ...current.layout.tables[0], id: 't3', name: 'M2' });
  await rpc(db, 'v2_floor_save_layout', [rid, current.revision, current.layout]);
  return db;
}
const selection = (tables = ['t1'], extra = {}) => floor(tables, { plan_revision: 3, ...extra });
const booking = extra => payload({ area_ids: [a], ...extra });
async function currentSelection(db, number) {
  const form = await rpc(db, 'v2_floor_form', [rid, id(number), null]);
  return { ...form.selection, source: form.source };
}

test('same room and time accepts different tables while a pending booking still protects its own table', async () => {
  const db = await sameRoom();
  try {
    await save(db, 1, booking({ status: 'pendiente', deposit: 75, notes: 'Original' }), selection());
    const before = await snapshot(db);
    await save(db, 2, booking({ client_name: 'Otra mesa' }), selection(['t3']));
    const after = await snapshot(db);
    assert.equal(after.reservations.length, 2);
    assert.deepEqual(after.reservations.find(row => row.id === id(1)), before.reservations[0]);
    assert.deepEqual(after.seats.find(row => row.reservation_id === id(1)), before.seats[0]);
    await assert.rejects(save(db, 3, booking(), selection()), /FLOOR_CONFLICT/);
    assert.deepEqual(await snapshot(db), after, 'conflict rejection must be atomic');
  } finally { await db.close(); }
});

test('an entire room conflicts with a partial booking in either direction; area-only bookings still occupy the room', async () => {
  for (const entireFirst of [false, true]) {
    const db = await sameRoom();
    try {
      const whole = selection([], { whole_area_id: 'salon' });
      await save(db, 1, booking(), entireFirst ? whole : selection());
      const before = await snapshot(db);
      if (entireFirst) assert.deepEqual(before.seats[0].table_ids.sort(), ['t1', 't3']);
      await assert.rejects(save(db, 2, booking(), entireFirst ? selection(['t3']) : whole), /FLOOR_CONFLICT/);
      await assert.rejects(save(db, 3, booking(), selection([])), /FLOOR_CONFLICT/);
      assert.deepEqual(await snapshot(db), before);
    } finally { await db.close(); }
  }
});

test('cancelled and finished reservations release tables without deleting their saved seating', async () => {
  for (const state of [{ status: 'cancelada' }, { service_status: 'finished' }]) {
    const db = await sameRoom();
    try {
      await save(db, 1, booking(), selection());
      await save(db, 1, state.status ? { status: state.status } : {}, {
        ...await currentSelection(db, 1), ...(state.service_status ? { service_status: state.service_status } : {}),
      }, false);
      const before = await snapshot(db);
      await save(db, 2, booking(), selection());
      const after = await snapshot(db);
      assert.deepEqual(after.seats.find(row => row.reservation_id === id(1)), before.seats[0]);
      assert.equal(after.reservations.length, 2);
    } finally { await db.close(); }
  }
});

test('editing excludes the same reservation but checks another party before changing tables', async () => {
  const db = await sameRoom();
  try {
    await save(db, 1, booking(), selection());
    await save(db, 2, booking(), selection(['t3']));
    await save(db, 1, { notes: 'Actualizada' }, await currentSelection(db, 1), false);
    const before = await snapshot(db);
    await assert.rejects(save(db, 2, {}, { ...await currentSelection(db, 2), table_ids: ['t1'] }, false), /FLOOR_CONFLICT/);
    assert.deepEqual(await snapshot(db), before);
  } finally { await db.close(); }
});

test('real durations use non-overlapping endpoints and detect overlaps across midnight', async () => {
  const db = await sameRoom();
  try {
    await save(db, 1, booking(), selection()); // 13:00–15:00
    await save(db, 2, booking({ event_time: '15:00' }), selection());
    await assert.rejects(save(db, 3, booking({ event_time: '14:59' }), selection()), /FLOOR_CONFLICT/);
    await save(db, 4, booking({ event_time: '23:00' }), selection(['t3']));
    await assert.rejects(save(db, 5, booking({ event_date: '2026-10-01', event_time: '00:59' }), selection(['t3'])), /FLOOR_CONFLICT/);
    await save(db, 6, booking({ event_date: '2026-10-01', event_time: '01:00' }), selection(['t3']));
  } finally { await db.close(); }
});

test('converting a quote on a different table in the same room does not require a conflict override', async () => {
  const db = await sameRoom();
  try {
    await save(db, 1, booking({ status: 'pendiente' }), selection());
    const q = await quote(db, null, selection(['t3']), booking());
    const converted = await rpc(db, 'v2_floor_convert_quote', [rid, q.id, expected()]);
    assert.equal(converted.quote_id, q.id);
    const form = await rpc(db, 'v2_floor_form', [rid, converted.id, null]);
    assert.deepEqual(form.selection.table_ids, ['t3']);
    assert.equal(form.selection.allow_conflict, undefined);
  } finally { await db.close(); }
});

test('older SQL44/45 installations already distinguish explicit different tables and entire rooms', async () => {
  const db = await database();
  try {
    await db.exec(fs.readFileSync('45_CRUCES_HORARIO_CONFIRMADOS.sql', 'utf8'));
    await save(db, 1, payload({ area: 'Salón', status: 'pendiente' }), floor(['t1']));
    await save(db, 2, payload({ area: 'Salón' }), floor(['t2']));
    await assert.rejects(save(db, 3, payload({ area: 'Salón' }), floor(['t1'])), /FLOOR_CONFLICT/);
    await assert.rejects(save(db, 4, payload({ area: 'Salón' }), floor([], { whole_area_id: 'salon' })), /FLOOR_CONFLICT/);
  } finally { await db.close(); }
});
