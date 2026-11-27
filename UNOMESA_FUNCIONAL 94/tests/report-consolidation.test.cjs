const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');

function load(file, cache = {}) {
  file = path.resolve(file);
  if (cache[file]) return cache[file].exports;
  const module = { exports: {} }; cache[file] = module;
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Date,
    require: name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts'), cache) : require(name),
  });
  return module.exports;
}
const { analyzeReport } = load('lib/report-consolidation.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const options = { from: '2026-03-01', to: '2026-03-31', today: '2026-03-15', en: false };
const analyze = (kind, rows, extra = {}) => analyzeReport(kind, rows, { ...options, ...extra });
const metric = (report, label) => report.metrics.find(item => item.label === label)?.value;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('conversion uses complete weighted counts, never averages the source percentages', () => {
  const source = [
    { Fecha: '01/03/2026', Area: 'Jardín', Cotizaciones: 100, Convertidas: 100, ConversionPct: 100 },
    { Fecha: '31/03/2026', Area: 'Jardín', Cotizaciones: '1', Convertidas: '0', ConversionPct: 0 },
    { Fecha: '01/04/2026', Area: 'Terraza', Cotizaciones: 9, Convertidas: 0, ConversionPct: 0 },
  ];
  const result = analyze('conversion', source, { to: '2026-04-30' });
  assert.equal(result.grouping, 'month');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].Mes, '2026-03');
  assert.equal(result.rows[0].Cotizaciones, 101);
  close(result.rows[0].ConversionPct, 100 / 101 * 100);
  assert.equal(metric(result, 'Cotizaciones'), 110);
  close(metric(result, 'Conversión global'), 100 / 110 * 100);
  assert.equal(analyze('conversion', source, { grouping: 'area' }).rows.length, 2);
  assert.deepEqual(plain(analyze('conversion', source, { grouping: 'detail' }).rows), source);
});

test('cancellation totals and rates retain every status in the denominator', () => {
  const rows = [
    { Fecha: '2026-03-01', Hora: '11:00', Area: 'Patio', Reservaciones: 100, Canceladas: 1, CancelacionPct: 1 },
    { Fecha: '2026-03-02', Hora: '12:00', Area: 'Patio', Reservaciones: 1, Canceladas: 1, CancelacionPct: 100 },
  ];
  const result = analyze('cancellations', rows);
  assert.equal(metric(result, 'Reservaciones'), 101);
  assert.equal(metric(result, 'No canceladas'), 99);
  close(metric(result, 'Tasa de cancelación'), 2 / 101 * 100);
  close(result.rows[0].CancelacionPct, 2 / 101 * 100);
  const bad = analyze('cancellations', [{ ...rows[0], Reservaciones: 1, Canceladas: 2 }]);
  assert.equal(metric(bad, 'Tasa de cancelación'), null);
  assert.equal(metric(bad, 'No canceladas'), null);
  assert.ok(bad.warnings.length);
});

test('empty populations return zero counts and unavailable percentages, never NaN', () => {
  for (const kind of ['conversion', 'cancellations', 'leadtime']) {
    const result = analyze(kind, []);
    assert.equal(result.metrics[0].value, 0);
    for (const item of result.metrics.filter(item => item.format === 'percent')) assert.equal(item.value, null);
    assert.ok(!JSON.stringify(result).includes('NaN'));
  }
  const demand = analyze('demand', []);
  assert.equal(demand.rows.length, 7);
  assert.ok(demand.rows.every(row => row.Reservaciones === 0 && row['Porcentaje (%)'] === null && row.PromedioReservas === 0));
  assert.equal(metric(demand, 'Día con más reservas'), null);
  const zero = analyze('conversion', [{ Fecha: '2026-03-01', Area: 'A', Cotizaciones: 0, Convertidas: 0, ConversionPct: 100 }]);
  assert.equal(zero.rows[0].ConversionPct, null);
});

test('weekday demand includes seven days and normalizes by calendar exposure across DST', () => {
  const source = [
    { Fecha: '2026-03-02', Hora: '12:00', Area: 'A', Reservaciones: 4, Invitados: 20 },
    { Fecha: '09/03/2026', Hora: '13:00', Area: 'A', Reservaciones: 2, Invitados: 10 },
    { Fecha: '2026-03-08', Hora: '23:30:00', Area: 'B', Reservaciones: 3, Invitados: 9 },
  ];
  const result = analyze('demand', source, { from: '2026-03-01', to: '2026-03-15' });
  assert.deepEqual(plain(result.rows.map(row => row.Dia)), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  assert.equal(result.rows[0].Reservaciones, 6);
  assert.equal(result.rows[0].PromedioReservas, 3); // Two Mondays, including the DST transition.
  assert.equal(result.rows[6].PromedioReservas, 1); // Three Sundays, two with no bookings.
  assert.equal(result.rows[1].PromedioReservas, 0);
  close(result.rows[0]['Porcentaje (%)'], 6 / 9 * 100);
  close(metric(result, 'Reservas por día calendario'), 9 / 15);
  assert.equal(metric(result, 'Día con más reservas'), 'Lunes');
  assert.equal(metric(result, 'Invitados reservados'), 39);
  const short = analyze('demand', [], { from: '2026-03-02', to: '2026-03-02' });
  assert.equal(short.rows[0].PromedioReservas, 0);
  assert.equal(short.rows[1].PromedioReservas, null); // No Tuesday in the selected range.
});

test('missing and malformed dates are retained rather than disappearing from demand or conversion', () => {
  const source = [
    { Fecha: '2026-03-02', Hora: '12:30', Area: 'A', Reservaciones: 2, Invitados: 4 },
    { Fecha: null, Hora: '14:30', Area: 'A', Reservaciones: 3, Invitados: 6 },
    { Fecha: '31/02/2026', Hora: '15:30', Area: 'A', Reservaciones: 1, Invitados: 2 },
  ];
  const result = analyze('demand', source);
  assert.equal(result.rows.length, 8);
  assert.equal(result.rows[7].Reservaciones, 4);
  assert.equal(metric(result, 'Reservaciones no canceladas'), 6);
  close(result.rows[7]['Porcentaje (%)'], 4 / 6 * 100);
  assert.equal(metric(result, 'Reservas por día calendario'), null);
  assert.equal(metric(result, 'Día con más reservas'), null);
  assert.ok(result.warnings.length);
  const quotes = analyze('conversion', [{ Fecha: '', Area: '', Cotizaciones: 2, Convertidas: 1 }]);
  assert.equal(quotes.rows[0].Cotizaciones, 2);
  assert.equal(quotes.rows[0].Mes, 'Sin fecha válida');
  assert.equal(quotes.rows[0].ConversionPct, 50);
});

test('hourly demand combines raw 24-hour times into whole-hour buckets and retains unknown times', () => {
  const source = [
    { Fecha: '2026-03-02', Hora: '13:01:00', Area: 'A', Reservaciones: 2, Invitados: 4 },
    { Fecha: '2026-03-02', Hora: '13:59', Area: 'B', Reservaciones: 3, Invitados: 6 },
    { Fecha: '2026-03-02', Hora: '1:30 PM', Area: 'B', Reservaciones: 1, Invitados: 2 },
    { Fecha: '2026-03-02', Hora: '12:00 AM', Area: 'B', Reservaciones: 1, Invitados: 2 },
    { Fecha: '2026-03-02', Hora: '25:01', Area: 'B', Reservaciones: 1, Invitados: 2 },
    { Fecha: '2026-03-02', Hora: '', Area: 'B', Reservaciones: 1, Invitados: 2 },
  ];
  const result = analyze('demand', source, { grouping: 'hour' });
  assert.deepEqual(plain(result.rows.map(row => [row.Hora, row.Reservaciones])), [['00:00', 1], ['13:00', 6], ['Sin hora válida', 2]]);
  assert.equal(result.columns.includes('PromedioReservas'), false);
  assert.ok(result.warnings.length);
  assert.equal(analyze('demand', source, { grouping: 'area' }).rows[1].Reservaciones, 7);
});

test('lead time merges repeated bands and recalculates shares using invalid-date records too', () => {
  const source = [
    { 'Anticipación': 'Mismo día', Reservaciones: 2, 'Porcentaje (%)': 90 },
    { 'Anticipación': 'Mismo día', Reservaciones: 3, 'Porcentaje (%)': 90 },
    { 'Anticipación': '1–3 días', Reservaciones: 5, 'Porcentaje (%)': 90 },
    { 'Anticipación': '8–30 días', Reservaciones: 5, 'Porcentaje (%)': 90 },
    { 'Anticipación': 'Registro posterior o sin fecha', Reservaciones: 5, 'Porcentaje (%)': 90 },
  ];
  const result = analyze('leadtime', source);
  assert.equal(result.grouping, 'summary');
  assert.equal(result.rows.length, 4);
  assert.equal(result.rows[0].Reservaciones, 5);
  assert.equal(result.rows[0]['Porcentaje (%)'], 25);
  assert.equal(metric(result, 'Reservaciones'), 20);
  assert.equal(metric(result, 'Con anticipación interpretable'), 15);
  assert.equal(metric(result, 'Con hasta 7 días registrados'), 50);
  assert.equal(result.metrics.some(item => /media|mediana|promedio/i.test(item.label)), false);
});

test('negative and unfamiliar lead bands do not become same-day bookings or invented averages', () => {
  const source = [
    { 'Anticipación': 'Mismo día', Reservaciones: 2 },
    { 'Anticipación': '-1 días', Reservaciones: 3 },
    { 'Anticipación': 'Importada', Reservaciones: 5 },
  ];
  const result = analyze('leadtime', source);
  assert.equal(result.rows.length, 3);
  assert.equal(metric(result, 'Reservaciones'), 10);
  assert.equal(metric(result, 'Con anticipación interpretable'), 2);
  assert.equal(metric(result, 'Con hasta 7 días registrados'), null);
  assert.equal(metric(result, 'Rango más frecuente'), null);
  assert.equal(result.rows.find(row => row['Anticipación'] === '-1 días')['Porcentaje (%)'], 30);
  assert.ok(result.warnings.length);
  const negativeOnly = analyze('leadtime', source.slice(0, 2));
  assert.equal(metric(negativeOnly, 'Con hasta 7 días registrados'), 40);
  assert.equal(metric(negativeOnly, 'Rango más frecuente'), 'Mismo día');
});

test('deposits count source records once, retain blank methods and never turn missing money into zero', () => {
  const source = [
    { Fecha: '01/03/2026', Cliente: 'Ana', Metodo: 'Efectivo', Anticipo: '100.50', Origen: 'Reserva' },
    { Fecha: '01/03/2026', Cliente: 'Luis', Metodo: 'Efectivo', Anticipo: 20, Origen: 'Cotización' },
    { Fecha: '01/03/2026', Cliente: 'Ana', Metodo: '', Anticipo: 30, Origen: 'Reserva' },
    { Fecha: '01/03/2026', Cliente: 'Marta', Metodo: null, Anticipo: null, Origen: 'Reserva' },
  ];
  const before = JSON.stringify(source);
  const result = analyze('deposits', source);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows.find(row => row.Metodo === 'Efectivo').Anticipo, 120.5);
  assert.equal(result.rows.find(row => row.Metodo === 'Sin método').Registros, 2);
  assert.equal(result.rows.find(row => row.Metodo === 'Sin método').Anticipo, null);
  assert.equal(metric(result, 'Anticipos registrados'), null);
  assert.equal(metric(result, 'Registros con anticipo'), 4);
  assert.equal(metric(result, 'Sin método registrado'), 2);
  assert.ok(result.warnings.length);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(plain(analyze('deposits', source, { grouping: 'detail' }).rows), source);
  assert.equal(metric(analyze('deposits', []), 'Anticipos registrados'), 0);
});

test('invalid numeric inputs poison affected sums instead of creating optimistic percentages or money', () => {
  for (const invalid of [null, '', 'invalid', Infinity, NaN]) {
    const result = analyze('conversion', [{ Fecha: '2026-03-01', Cotizaciones: invalid, Convertidas: 1 }]);
    assert.equal(metric(result, 'Cotizaciones'), null);
    assert.equal(metric(result, 'Conversión global'), null);
    assert.equal(result.rows[0].ConversionPct, null);
    assert.ok(result.warnings.length);
  }
  const approved = analyze('approved', [{ Numero: '#1', Venta: 100, Anticipo: 30, Saldo: '' }]);
  assert.equal(metric(approved, 'Valor aprobado'), 100);
  assert.equal(metric(approved, 'Saldo en cotizaciones'), null);
  assert.ok(approved.warnings.length);
});

test('operational detail summaries distinguish guest cancellations, employee-days, and quote follow-up', () => {
  const reserved = analyze('reserved', [
    { Estado: 'confirmada', Invitados: 5 }, { Estado: 'CANCELADA', Invitados: 100 }, { Estado: 'pendiente', Invitados: 3 },
  ]);
  assert.equal(metric(reserved, 'Reservaciones'), 3);
  assert.equal(metric(reserved, 'No canceladas'), 2);
  assert.equal(metric(reserved, 'Invitados no cancelados'), 8);
  const employees = analyze('employees', [
    { Empleado: 'Ana', Dias: 2, HorasNetas: 16, SinCalculo: 0 }, { Empleado: 'Luis', Dias: 2, HorasNetas: 8, SinCalculo: 1 },
  ]);
  assert.equal(metric(employees, 'Días de empleado programados'), 4);
  assert.equal(metric(employees, 'Horas netas calculadas'), 24);
  assert.ok(employees.warnings.length);
  const pending = analyze('pending', [{ Fecha: '2026-03-01', Total: 20 }, { Fecha: '2026-03-15', Total: 30 }, { Fecha: '2026-03-25', Total: 40 }]);
  assert.equal(metric(pending, 'Con fecha de evento pasada'), 1);
  assert.equal(metric(pending, 'Valor pendiente de aprobación'), 90);
});

test('comparison promotes only explicit known indicators and keeps conversion differences in percentage points', () => {
  const rows = [
    { Indicador: 'Reservaciones', Actual: 10, Anterior: 0, Diferencia: 10 },
    { Indicador: 'Conversión (%)', Actual: 50, Anterior: null, Diferencia: null },
    { Indicador: 'Unknown future metric', Actual: 1000, Anterior: 500, Diferencia: 500 },
  ];
  const result = analyze('comparison', rows);
  assert.deepEqual(plain(result.rows), rows);
  assert.equal(result.metrics.length, 2);
  assert.equal(metric(result, 'Reservaciones'), 10);
  assert.equal(metric(result, 'Conversión'), 50);
  assert.equal(result.metrics[1].format, 'percent');
  assert.match(result.metrics[1].hint, /Anterior: — · Diferencia: —/);
  assert.match(result.description, /puntos porcentuales/);
  const conversion = analyze('comparison', [{ Indicador: 'Conversión %', Actual: 60, Anterior: 40, Diferencia: 20 }]);
  assert.match(conversion.metrics[0].hint, /Anterior: 40% · Diferencia: 20 pp/);
  assert.equal(analyze('comparison', [rows[2]]).metrics.length, 0);
  assert.equal(analyze('comparison', [rows[0], rows[0]]).metrics.length, 0); // An ambiguous repeated label is not guessed.
});

test('English labels are produced without changing customer, area or method values', () => {
  const demand = analyze('demand', [{ Fecha: '2026-03-02', Hora: '12:00', Area: 'Jardín', Reservaciones: 1, Invitados: 2 }], { en: true });
  assert.equal(demand.rows[0].Dia, 'Monday');
  assert.equal(metric(demand, 'Booked guests'), 2);
  assert.equal(analyze('demand', [{ Fecha: '2026-03-02', Area: 'Jardín', Reservaciones: 1, Invitados: 2 }], { grouping: 'area', en: true }).rows[0].Area, 'Jardín');
  const lead = analyze('leadtime', [{ 'Anticipación': '1–3 días', Reservaciones: 1 }], { en: true });
  assert.equal(lead.rows[0]['Anticipación'], '1–3 days');
  assert.equal(analyze('deposits', [{ Metodo: 'Efectivo', Anticipo: 1 }], { en: true }).rows[0].Metodo, 'Efectivo');
});
