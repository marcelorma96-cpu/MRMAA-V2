const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const cache=new Map();function load(name){const file=path.resolve(__dirname,'../lib',name+'.ts');if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:p=>load(p.replace('./',''))});return module.exports;}
const {floorAreaBounds,floorMapAreaGeometry,resizeFloorMapArea}=load('floor-area-bounds'),{positionArea}=load('restaurant-map');
const table={id:'t1',areaId:'garden',name:'M1',seats:8,shape:'rectangle',size:70,rotation:0,x:30,y:35};
const layout={areas:[{id:'garden',name:'Jardín',placement:{x:30,y:20,width:35,height:50}}],tables:[table,{...table,id:'t2',x:55,y:60,rotation:90}]};
test('area outline encloses rotated and resized tables without rewriting their saved geometry',()=>{
 const before=JSON.stringify(layout),bounds=floorAreaBounds(layout.tables);assert(bounds.width<936&&bounds.height<590);
 for(const t of layout.tables){const rx=(t.rotation===90?40:71)*.7,ry=(t.rotation===90?71:40)*.7;assert(bounds.x<t.x*10-rx&&bounds.y<t.y*6.5-ry);assert(bounds.x+bounds.width>t.x*10+rx&&bounds.y+bounds.height>t.y*6.5+ry);}
 const map=floorMapAreaGeometry(layout,layout.areas[0]);assert(map.frame.width<map.canvas.width);assert(map.frame.height<map.canvas.height);assert.equal(JSON.stringify(layout),before);
});
test('visible corner resizing keeps the contour anchored and tables proportional; empty areas retain their frame',()=>{
 const before=JSON.stringify(layout),original=floorMapAreaGeometry(layout,layout.areas[0]);
 const patch=resizeFloorMapArea(original,original.frame.width*1.1,original.frame.height*1.1),next=positionArea(layout,'garden',patch),after=floorMapAreaGeometry(next,next.areas[0]);
 for(const axis of ['x','y'])assert(Math.abs(after.frame[axis]-original.frame[axis])<.0001);
 for(const axis of ['width','height'])assert(Math.abs(after.frame[axis]-original.frame[axis]*1.1)<.0001);
 assert.equal(next.tables,layout.tables);assert.equal(JSON.stringify(layout),before);
 const empty=floorMapAreaGeometry({...layout,tables:[]},layout.areas[0]);assert.deepEqual(empty.frame,empty.canvas);
});

test('each visible corner can reach the restaurant edges without resizing or changing table data',()=>{
 const before=JSON.stringify(layout),original=floorMapAreaGeometry(layout,layout.areas[0]);
 for(const x of [-1000,1000])for(const y of [-1000,1000]){
  const next=positionArea(layout,'garden',{x,y}),after=floorMapAreaGeometry(next,next.areas[0]);
  assert(Math.abs((x<0?after.frame.x:after.frame.x+after.frame.width)-(x<0?2:98)*11)<.00001);
  assert(Math.abs((y<0?after.frame.y:after.frame.y+after.frame.height)-(y<0?2:98)*7.6)<.00001);
  assert.equal(after.frame.width,original.frame.width);assert.equal(after.frame.height,original.frame.height);
  assert.equal(next.tables,layout.tables);
  // A read/save round trip must not clamp the off-board virtual canvas back inward.
  const read=floorMapAreaGeometry(JSON.parse(JSON.stringify(next)),next.areas[0]);assert.deepEqual(read,after);
 }
 assert.equal(JSON.stringify(layout),before);
});
test('an oversized resize anchors the visible corner even when virtual dimensions reach their limit',()=>{
 const original=floorMapAreaGeometry(layout,layout.areas[0]);
 const next=positionArea(layout,'garden',resizeFloorMapArea(original,1e5,1e5)),after=floorMapAreaGeometry(next,next.areas[0]);
 assert(Math.abs(next.areas[0].placement.width-96)<.00001);assert(Math.abs(next.areas[0].placement.height-96)<.00001);
 assert(Math.abs(after.frame.x-original.frame.x)<.00001);assert(Math.abs(after.frame.y-original.frame.y)<.00001);
 assert.equal(next.tables,layout.tables);
});
