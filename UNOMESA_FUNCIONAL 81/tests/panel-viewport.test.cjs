const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=require('./helpers/load-ts.cjs');

// Exercise browser viewport events with a hook adapter; this is not a device renderer.
function mount({height=800,offsetTop=0,available=true,open=true}={}){
 const listeners=new Map(),frames=new Map();let next=0,style,cleanup;
 const viewport={height,offsetTop,
  addEventListener(type,callback){listeners.set(type,callback);},
  removeEventListener(type,callback){if(listeners.get(type)===callback)listeners.delete(type);}
 };
 const {usePanelViewport}=load('components/use-panel-viewport.ts',{
  react:{useState:()=>[undefined,value=>{style=value;}],useEffect:effect=>{cleanup=effect();}}
 },{
  window:{visualViewport:available?viewport:undefined},
  requestAnimationFrame:callback=>{const id=++next;frames.set(id,callback);return id;},
  cancelAnimationFrame:id=>frames.delete(id)
 });
 usePanelViewport(open);
 return {
  get style(){return style;},get pending(){return frames.size;},get listeners(){return listeners.size;},
  flush(){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback());},
  change(values,event='resize'){Object.assign(viewport,values);listeners.get(event)?.();},
  unmount(){cleanup?.();}
 };
}

test('Android-style keyboard resize keeps the overlay inside the visible height',()=>{
 const panel=mount({height:800});panel.flush();assert.equal(panel.style.height,800);
 panel.change({height:420});panel.flush();assert.equal(panel.style.height,420);assert.equal(panel.style.bottom,'auto');
 panel.change({height:800});panel.flush();assert.equal(panel.style.height,800);
 panel.unmount();
});

test('iOS-style keyboard scrolling follows both the visible top and height',()=>{
 const panel=mount({height:844});panel.flush();
 panel.change({height:390,offsetTop:65});panel.flush();
 assert.equal(panel.style.top,65);assert.equal(panel.style.height,390);
 panel.change({offsetTop:108},'scroll');panel.flush();assert.equal(panel.style.top,108);
 panel.change({height:844,offsetTop:0});panel.flush();
 assert.equal(panel.style.top,0);assert.equal(panel.style.height,844);panel.unmount();
});

test('phone and tablet rotation update the visible height without remounting',()=>{
 for(const [portrait,landscape] of [[844,390],[1024,768],[1280,800]]){
  const panel=mount({height:portrait});panel.flush();
  panel.change({height:landscape});panel.flush();assert.equal(panel.style.height,landscape);
  assert.equal(panel.style['--panel-height'],`${landscape}px`);
  panel.change({height:portrait});panel.flush();assert.equal(panel.style.height,portrait);panel.unmount();
 }
});

test('rapid keyboard events use the latest bounds and cleanup cancels queued updates',()=>{
 const panel=mount();panel.change({height:520});panel.change({height:350,offsetTop:24},'scroll');
 assert.equal(panel.pending,1);panel.flush();assert.equal(panel.style.height,350);assert.equal(panel.style.top,24);
 panel.change({height:800});panel.unmount();assert.equal(panel.pending,0);assert.equal(panel.listeners,0);
 panel.flush();assert.equal(panel.style.height,350);
});

test('closed panels and browsers without VisualViewport leave CSS sizing in control',()=>{
 for(const options of [{open:false},{available:false}]){
  const panel=mount(options);assert.equal(panel.style,undefined);assert.equal(panel.pending,0);assert.equal(panel.listeners,0);panel.unmount();
 }
});
