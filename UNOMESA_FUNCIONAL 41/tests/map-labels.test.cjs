const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const moduleLabel={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/map-labels.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleLabel,exports:moduleLabel.exports});
const {placeMapLabels}=moduleLabel.exports;
function check(areas,obstacles=[],unit=1){
 const before=JSON.stringify({areas,obstacles}),labels=placeMapLabels(areas,obstacles,unit);
 assert.equal(labels.length,areas.length);assert.deepEqual([...labels.map(l=>l.id)].sort(),areas.map(a=>a.id).sort());
 for(const a of labels){assert(a.x>=0&&a.y>=0);assert.equal(a.lines.length,1);assert.equal(a.height,28*unit);for(const table of obstacles)assert(!(a.x<table.x+table.width&&a.x+a.width>table.x&&a.y<table.y+table.height&&a.y+a.height>table.y),'label covers a table');for(const b of labels)if(a.id!==b.id)assert(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),`${a.id} overlaps ${b.id}`);}
 assert.equal(JSON.stringify({areas,obstacles}),before);assert.equal(JSON.stringify(placeMapLabels(areas,obstacles,unit)),JSON.stringify(labels));return labels;
}
test('coincident rooms and long names remain legible without moving saved room coordinates',()=>{
 for(const [x,y] of [[22,16],[500,350],[920,640]])check(Array.from({length:20},(_,i)=>({id:`a${i}`,name:`Salón de celebraciones número ${i+1} con terraza`,x,y,width:154,height:106})),[{x:0,y:0,width:1100,height:760}]);
});
test('normal room titles avoid tables when space is available and stay inside the canvas at its edges',()=>{
 const areas=[{id:'a',name:'Principal',x:20,y:20,width:480,height:650},{id:'b',name:'Terraza',x:600,y:20,width:480,height:650}];
 const table={x:32,y:28,width:150,height:160},labels=check(areas,[table]);const first=labels[0];assert(!(first.x<table.x+table.width&&first.x+first.width>table.x&&first.y<table.y+table.height&&first.y+first.height>table.y));
 check([{id:'edge',name:'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',x:940,y:650,width:154,height:106}]);check([]);
});

test('single-line labels use empty outer margins when the map is full; full names remain intact',()=>{
 const room={id:'a',name:'Salón privado para celebraciones y eventos especiales',x:60,y:70,width:400,height:400};
 const labels=check([room],[{x:0,y:0,width:1100,height:760}]);assert(labels[0].y>760);assert.equal(labels[0].name,room.name);assert(labels[0].text.endsWith('…'));
 for(const unit of [.4,1,3.2]){const normal=check([room],[],unit)[0];assert(normal.width<=186*unit);assert(normal.height<64*unit);}
});

test('screen names stay beside their areas even at phone scale, with no outer strip',()=>{
 const {placeAnchoredMapLabels}=moduleLabel.exports;
 const areas=Array.from({length:14},(_,i)=>({id:`r${i}`,name:`Salón largo para eventos ${i}`,x:(i%4)*250,y:Math.floor(i/4)*180,width:210,height:140}));
 const original=JSON.stringify(areas),labels=placeAnchoredMapLabels(areas,4);
 for(const label of labels){const room=areas.find(a=>a.id===label.id);assert(label.x>=room.x);assert(label.x+label.width<=room.x+room.width);assert(label.y>=room.y-40&&label.y<=room.y+8);assert(label.name===room.name)}
 assert.equal(JSON.stringify(areas),original);
 const coincident=areas.map(a=>({...a,x:10,y:10})),priority=placeAnchoredMapLabels(coincident,4,'r10');
 assert(priority.find(a=>a.id==='r10').visible);const shown=priority.filter(a=>a.visible);
 for(const a of shown)for(const b of shown)if(a.id!==b.id)assert(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y));
});
