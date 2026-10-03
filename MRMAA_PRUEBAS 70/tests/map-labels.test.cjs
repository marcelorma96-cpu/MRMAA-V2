const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const moduleLabel={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/map-labels.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleLabel,exports:moduleLabel.exports});
const {placeMapLabels}=moduleLabel.exports;
function check(areas,obstacles=[]){
 const before=JSON.stringify({areas,obstacles}),labels=placeMapLabels(areas,obstacles);
 assert.equal(labels.length,areas.length);assert.deepEqual([...labels.map(l=>l.id)].sort(),areas.map(a=>a.id).sort());
 for(const a of labels){assert(a.x>=0&&a.y>=0&&a.x+a.width<=1100&&a.y+a.height<=760);assert(a.lines.length<=2);for(const b of labels)if(a.id!==b.id)assert(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),`${a.id} overlaps ${b.id}`);}
 assert.equal(JSON.stringify({areas,obstacles}),before);assert.equal(JSON.stringify(placeMapLabels(areas,obstacles)),JSON.stringify(labels));return labels;
}
test('coincident rooms and long names remain legible without moving saved room coordinates',()=>{
 for(const [x,y] of [[22,16],[500,350],[920,640]])check(Array.from({length:20},(_,i)=>({id:`a${i}`,name:`Salón de celebraciones número ${i+1} con terraza`,x,y,width:154,height:106})),[{x:0,y:0,width:1100,height:760}]);
});
test('normal room titles avoid tables when space is available and stay inside the canvas at its edges',()=>{
 const areas=[{id:'a',name:'Principal',x:20,y:20,width:480,height:650},{id:'b',name:'Terraza',x:600,y:20,width:480,height:650}];
 const table={x:32,y:28,width:150,height:160},labels=check(areas,[table]);const first=labels[0];assert(!(first.x<table.x+table.width&&first.x+first.width>table.x&&first.y<table.y+table.height&&first.y+first.height>table.y));
 check([{id:'edge',name:'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',x:940,y:650,width:154,height:106}]);check([]);
});
