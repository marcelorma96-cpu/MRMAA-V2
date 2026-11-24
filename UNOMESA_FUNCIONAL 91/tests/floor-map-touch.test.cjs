const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run the real gesture handlers with pointer capture and viewport geometry.
// The small hook host keeps refs/state between renders, without a live account.
function fixture({editing = false, overflow = true, direct = true} = {}) {
  const slots = []; let cursor = 0, map, calls = [], canceled = 0;
  const hooks = {
    useRef(value) {const i = cursor++; return slots[i] ||= {current: value};},
    useState(value) {const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => {slots[i] = typeof next === 'function' ? next(slots[i]) : next;}];},
    useCallback: fn => fn, useLayoutEffect() {}, useContext() {return {};}
  };
  const capture = new Set(), page = {scrollTop: 80};
  const viewport = {
    scrollLeft: 40, scrollTop: 60, clientWidth: 360, clientHeight: 420,
    scrollWidth: overflow ? 720 : 360, scrollHeight: overflow ? 840 : 420,
    parentElement: null, contains: node => node.connected,
    setPointerCapture: id => capture.add(id), hasPointerCapture: id => capture.has(id),
    releasePointerCapture: id => capture.delete(id),
    getBoundingClientRect: () => ({left: 0, top: 0}), querySelector: () => null
  };
  const table = {connected: true, blocked: false, closest: () => table.blocked ? table : null};
  const shape = {closest: selector => selector === '[role="button"]' ? table : null};
  const exports = {};
  const file = process.env.MAP_NAVIGATION_SOURCE || 'components/map-navigation.tsx';
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
  }).outputText;
  vm.runInNewContext(code, {exports, require: name => name === 'react' ? hooks : name === './floor-touch' ? {} : require(name),
    document: {scrollingElement: page}, getComputedStyle: () => ({overflowY: 'auto'})}, {filename: file});
  const render = () => {
    cursor = 0;
    map = exports.useMapNavigation(editing, () => canceled++, direct ? target => calls.push(target) : undefined);
    map.viewport.current = viewport;
  };
  render();
  function event(type, {id = 1, x = 100, y = 100, pointerType = 'touch', button = 0, target = shape} = {}) {
    const e = {type, pointerId: id, clientX: x, clientY: y, pointerType, button, target, currentTarget: viewport,
      preventDefault() {this.prevented = true;}, stopPropagation() {this.stopped = true;}};
    map.bindings[{pointerdown: 'onPointerDownCapture', pointermove: 'onPointerMoveCapture', pointerup: 'onPointerUpCapture', pointercancel: 'onPointerCancelCapture', click: 'onClickCapture'}[type]](e);
    render(); return e;
  }
  return {event, calls, table, viewport, page, capture, get canceled() {return canceled;}, get map() {return map;},
    hand() {map.setHand(true); render();}};
}

test('one touch activates its table on release without waiting for a synthesized click', () => {
  const f = fixture(); f.event('pointerdown');
  assert.equal(f.calls.length, 0);
  assert.equal(f.event('pointerup').stopped, true);
  assert.deepEqual(f.calls, [f.table]);
  assert.equal(f.event('click').stopped, true); // Do not toggle selection twice.
  assert.equal(f.calls.length, 1);
});
test('small finger drift still selects; the next tap works even without a compatibility click', () => {
  const f = fixture();
  for (let id = 1; id <= 2; id++) {
    f.event('pointerdown', {id}); f.event('pointermove', {id, x: 108, y: 102});
    f.event('pointerup', {id, x: 108, y: 102});
  }
  assert.equal(f.calls.length, 2);
  assert.equal(f.viewport.scrollLeft, 40);
  assert.equal(f.capture.size, 0);
});
test('a deliberate drag pans without opening a table or its delayed click', () => {
  const f = fixture(); f.event('pointerdown'); f.event('pointermove', {x: 70});
  assert.equal(f.viewport.scrollLeft, 70); assert(f.capture.has(1));
  assert.equal(f.event('pointerup', {x: 70}).stopped, true);
  assert.equal(f.event('click').stopped, true);
  assert.equal(f.calls.length, 0); assert.equal(f.capture.size, 0);
});
test('returning to the start after dragging never turns the gesture into a tap', () => {
  const f = fixture(); f.event('pointerdown'); f.event('pointermove', {y: 130});
  f.event('pointermove'); f.event('pointerup'); assert.equal(f.calls.length, 0);
});
test('the release coordinate also rejects a drag when the browser coalesces move events', () => {
  const f = fixture(); f.event('pointerdown'); f.event('pointerup', {x: 150});
  assert.equal(f.calls.length, 0); assert.equal(f.event('click').stopped, true);
});
test('touch cancellation, a removed table and inert content do not activate', () => {
  for (const mode of ['cancel', 'removed', 'inert']) {
    const f = fixture(); f.event('pointerdown');
    if (mode === 'removed') f.table.connected = false;
    if (mode === 'inert') f.table.blocked = true;
    f.event(mode === 'cancel' ? 'pointercancel' : 'pointerup'); assert.equal(f.calls.length, 0);
  }
});
test('pinch zoom cancels the object gesture and neither finger opens a table', () => {
  const f = fixture(); f.event('pointerdown'); f.event('pointerdown', {id: 2, x: 200});
  f.event('pointermove', {id: 2, x: 250});
  assert(f.map.zoom > 1); assert.equal(f.canceled, 1);
  f.event('pointerup', {id: 2, x: 250}); f.event('pointerup');
  assert.equal(f.calls.length, 0); assert.equal(f.capture.size, 0);
  f.event('click'); f.event('pointerdown'); f.event('pointerup'); assert.equal(f.calls.length, 1);
});
test('fitted maps allow taps and page scrolling without confusing the two', () => {
  const f = fixture({overflow: false}); f.event('pointerdown'); f.event('pointerup');
  assert.equal(f.calls.length, 1);
  f.event('pointerdown'); f.event('pointermove', {y: 60}); f.event('pointerup', {y: 60});
  assert.equal(f.page.scrollTop, 120); assert.equal(f.calls.length, 1);
});
test('hand mode only navigates and layout editing retains the object handlers', () => {
  const hand = fixture(); hand.hand(); hand.event('pointerdown'); hand.event('pointerup');
  assert.equal(hand.calls.length, 0);
  const edit = fixture({editing: true});
  assert.equal(edit.event('pointerdown').stopped, undefined);
  assert.equal(edit.event('pointermove', {x: 160}).stopped, undefined);
  assert.equal(edit.event('pointerup', {x: 160}).stopped, undefined);
  assert.equal(edit.calls.length, 0);
});
test('desktop mouse activation remains with the existing table handlers', () => {
  const f = fixture(); f.event('pointerdown', {pointerType: 'mouse'});
  assert.equal(f.event('pointerup', {pointerType: 'mouse'}).stopped, undefined);
  assert.equal(f.event('click', {pointerType: 'mouse'}).stopped, undefined);
  assert.equal(f.calls.length, 0);
});
