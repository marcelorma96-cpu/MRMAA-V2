const test = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const load = require('./helpers/load-ts.cjs');
const {calendarDate, calendarISO, shiftCalendarDay, shiftCalendarMonth, clampCalendarDate, calendarMonthDays, calendarKeyDate} = load('lib/calendar-date.ts');

test('day navigation crosses month/year boundaries and leap days', () => {
  assert.equal(shiftCalendarDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftCalendarDay('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftCalendarDay('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftCalendarDay('2025-02-28', 1), '2025-03-01');
});

test('month/year changes preserve dates without overflowing into a later month', () => {
  assert.equal(shiftCalendarMonth('2024-01-31', 1), '2024-02-29');
  assert.equal(shiftCalendarMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftCalendarMonth('2024-02-29', 12), '2025-02-28');
  assert.equal(shiftCalendarMonth('2026-12-15', 1), '2027-01-15');
  assert.equal(shiftCalendarMonth('2026-03-31', -1), '2026-02-28');
});

test('month grid aligns weekdays and includes every date exactly once', () => {
  const days = calendarMonthDays('2026-10-01');
  assert.equal(days.length, 42);
  assert.equal(days[0], '2026-09-27');
  assert.equal(days[4], '2026-10-01');
  assert.equal(days[34], '2026-10-31');
  assert.equal(days.at(-1), '2026-11-07');
  assert.equal(new Set(days).size, 42);
  assert.equal(days.filter(day => day.startsWith('2026-10-')).length, 31);
});

test('keyboard browsing moves across months, weeks and years', () => {
  assert.equal(calendarKeyDate('2026-10-31', 'ArrowRight', false), '2026-11-01');
  assert.equal(calendarKeyDate('2026-10-30', 'ArrowUp', false), '2026-10-23');
  assert.equal(calendarKeyDate('2026-10-30', 'ArrowDown', false), '2026-11-06');
  assert.equal(calendarKeyDate('2026-10-30', 'Home', false), '2026-10-25');
  assert.equal(calendarKeyDate('2026-10-30', 'End', false), '2026-10-31');
  assert.equal(calendarKeyDate('2026-03-31', 'PageUp', false), '2026-02-28');
  assert.equal(calendarKeyDate('2024-02-29', 'PageDown', true), '2025-02-28');
  assert.equal(calendarKeyDate('2026-10-30', 'Tab', false), null);
});

test('keyboard and month changes respect date bounds', () => {
  const min = '2026-10-15', max = '2026-11-10';
  assert.equal(calendarKeyDate(min, 'ArrowLeft', false, min, max), min);
  assert.equal(calendarKeyDate(max, 'ArrowRight', false, min, max), max);
  assert.equal(calendarKeyDate('2026-10-30', 'PageDown', false, min, max), max);
  assert.equal(clampCalendarDate('2026-10-01', min, max), min);
  assert.equal(clampCalendarDate('2026-10-30', min, max), '2026-10-30');
});

test('four-digit years and the supported date extremes remain correct', () => {
  assert.equal(calendarISO(calendarDate('0099-01-01')), '0099-01-01');
  assert.equal(shiftCalendarMonth('0004-01-31', 1), '0004-02-29');
  assert.equal(calendarKeyDate('0001-01-01', 'ArrowLeft', false, '0001-01-01', '9999-12-31'), '0001-01-01');
  assert.equal(calendarKeyDate('9999-12-31', 'ArrowRight', false, '0001-01-01', '9999-12-31'), '9999-12-31');
});

test('local calendar navigation does not shift dates with timezone or daylight saving', () => {
  for (const zone of ['America/Guatemala', 'America/New_York', 'Europe/Madrid', 'Pacific/Auckland']) {
    const script = `const load=require('./tests/helpers/load-ts.cjs');const c=load('lib/calendar-date.ts');process.stdout.write(JSON.stringify(['2026-03-08','2026-11-01','2026-03-29','2026-10-25'].map(d=>[c.calendarISO(c.calendarDate(d)),c.shiftCalendarDay(d,1)])))`;
    const result = JSON.parse(execFileSync(process.execPath, ['-e', script], {env: {...process.env, TZ: zone}, encoding: 'utf8'}));
    assert.deepEqual(result, [['2026-03-08','2026-03-09'],['2026-11-01','2026-11-02'],['2026-03-29','2026-03-30'],['2026-10-25','2026-10-26']], zone);
  }
});
