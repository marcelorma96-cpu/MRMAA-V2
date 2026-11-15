const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

// Render the real controls without a browser or a live restaurant account.
// Surrounding app menu and calendar are outside this regression's scope.
function component(file, deps) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  vm.runInNewContext(code, {exports, require: id => deps[id] || require(id), Date, Intl, Map, Set, Math, document: {}}, {filename: file});
  return exports;
}
const touch = component('components/floor-touch.tsx', {
  './date-navigator': {DateNavigator: () => React.createElement('div', {'data-calendar-action': true})},
  './use-panel-viewport': {}, './dashboard-frame': {DashboardMenuButton: () => null}, '@/lib/app-mode': {}
});
const {MapNavigation, MAX_MAP_ZOOM} = component('components/map-navigation.tsx', {'./floor-touch': touch});
const noop = () => {};
function inspect(Component, props, overrides = {}) {
  let tree;
  function Probe() {tree = Component(props); return tree;}
  const html = renderToStaticMarkup(React.createElement(touch.FloorTouchContext.Provider, {
    value: {enabled: true, panel: null, open: noop, en: false, ...overrides}
  }, React.createElement(Probe)));
  const buttons = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'button') buttons.push(node.props);
    React.Children.forEach(node.props?.children, walk);
  }
  walk(tree);
  return {html, buttons, find: label => buttons.find(p => p['aria-label'] === label)};
}
function mapState(zoom = 1) {
  return {zoom, hand: false, wide: false, setHand: noop, setWide: noop,
    setZoom(value) {this.zoom = typeof value === 'function' ? value(this.zoom) : value;},
    reset() {this.zoom = 1;}};
}
function mapView(map, ctx) {
  // Bind the test adapter like the actual React setters (no dependence on `this`).
  return inspect(MapNavigation, {map: {...map, setZoom: map.setZoom.bind(map), reset: map.reset.bind(map)}, en: false}, ctx);
}
test('touch users can zoom from the initial fitted map and fit again', () => {
  const map = mapState();
  const initial = mapView(map);
  assert(initial.find('Acercar plano'));
  assert.equal(initial.find('Alejar plano').disabled, true);
  initial.find('Acercar plano').onClick();
  assert(map.zoom > 1);
  assert.equal(mapView(map).find('Alejar plano').disabled, false);
  mapView(map).find('Ajustar plano completo').onClick();
  assert.equal(map.zoom, 1);
});
test('zoom controls respect limits and zoom in/out is reversible', () => {
  const map = mapState(2);
  mapView(map).find('Acercar plano').onClick();
  mapView(map).find('Alejar plano').onClick();
  assert.equal(map.zoom, 2);
  map.zoom = MAX_MAP_ZOOM - .1;
  mapView(map).find('Acercar plano').onClick();
  assert.equal(map.zoom, MAX_MAP_ZOOM);
  assert.equal(mapView(map).find('Acercar plano').disabled, true);
  map.zoom = 1.1;
  mapView(map).find('Alejar plano').onClick();
  assert.equal(map.zoom, 1);
});
test('expanded controls still allow mouse and trackpad users to enable panning', () => {
  const map = mapState(); let hand = false;
  map.setHand = update => {hand = update(hand);};
  mapView(map, {expanded: true}).find('Mover mapa').onClick();
  assert.equal(hand, true);
});
test('desktop expand uses the shared view when available and retains editor fallback', () => {
  const map = mapState(); let expanded = 0, wide = false;
  map.setWide = update => {wide = update(wide);};
  mapView(map, {enabled: false, toggleExpanded: () => expanded++}).find('Ampliar plano').onClick();
  assert.equal(expanded, 1);
  assert.equal(wide, false);
  mapView(map, {enabled: false}).find('Ampliar plano').onClick();
  assert.equal(wide, true);
});
const headerProps = {restaurant: 'Prueba', date: '2026-10-31', time: '13:00', onPrevious: noop,
  onNext: noop, onChange: noop, disabled: false, editing: false, count: 3, allDay: false, onToggleAll: noop};
test('normal header exposes expansion without removing the calendar', () => {
  let expanded = 0;
  const view = inspect(touch.FloorTouchHeader, headerProps, {toggleExpanded: () => expanded++});
  view.find('Ampliar plano').onClick();
  assert.equal(expanded, 1);
  assert.match(view.html, /data-calendar-action/);
  assert(view.find('Mostrar todas las reservas del día'));
});
test('expanded header retains date context, reservation access, options and exit', () => {
  let closed = 0, panel = null, agenda = 0;
  const view = inspect(touch.FloorTouchHeader, {...headerProps, onAgenda: () => agenda++}, {
    expanded: true, toggleExpanded: () => closed++, open: name => {panel = name;}
  });
  assert.match(view.html, /31 oct 2026/);
  assert.match(view.html, /13:00/);
  assert.doesNotMatch(view.html, /data-calendar-action/);
  view.find('Cambiar fecha, hora y filtros').onClick(); assert.equal(panel, 'filters');
  view.find('Reservaciones').onClick(); assert.equal(agenda, 1);
  view.find('Opciones del plano').onClick(); assert.equal(panel, 'tools');
  view.find('Volver a la vista normal').onClick(); assert.equal(closed, 1);
});
