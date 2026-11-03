const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../lib');
function fixture(rows=[],options={}){
 const writes=[],reads=[];
 function load(name){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:id=>id==='./account-access'?{readCatalog:async(client,rid,table,order,active)=>{reads.push({rid,table,active});return {data:rows.filter(a=>a.restaurant_id===rid),error:null}}}:load(id.slice(2))});return module.exports;}
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async()=>({data:{role:options.role||'gerente',status:'activo'}}),from:table=>{
  let op,payload,filters={};const q={insert(value){op='insert';payload=value;return q},update(value){op='update';payload=value;return q},eq(k,v){filters[k]=v;return q},select(){return q},async single(){
   writes.push({table,op,payload:JSON.parse(JSON.stringify(payload)),filters:JSON.parse(JSON.stringify(filters))});
   if(op==='insert'){
    if(options.race){rows.push({id:'concurrent',restaurant_id:payload.restaurant_id,name:payload.name,active:true});return {error:{code:'23505'}};}
    if(options.fail)return {error:{code:'NETWORK',message:'Offline'}};
    const added={...payload,id:'new',active:true};rows.push(added);return {data:added,error:null};
   }
   const row=rows.find(r=>Object.entries(filters).every(([k,v])=>r[k]===v));assert(row);Object.assign(row,payload);return {data:{id:row.id,name:row.name},error:null};
  }};return q;
 }};
 return {rows,writes,reads,ensure:name=>load('event-area-catalog').ensureEventArea(client,'restaurant',name)};
}
test('shared catalog preserves IDs, spelling, existing rows and archived links',async()=>{
 const f=fixture([{id:'old',restaurant_id:'restaurant',name:'Salón privado',active:false,position:3},{id:'other',restaurant_id:'another',name:'Terraza',active:true}]);
 const saved=await f.ensure(' SALON   PRIVADO ');assert.equal(saved.id,'old');assert.equal(saved.name,'Salón privado');assert.equal(f.rows[0].position,3);assert.deepEqual(f.writes[0].payload,{active:true});assert.deepEqual(f.writes[0].filters,{restaurant_id:'restaurant',id:'old'});
 await f.ensure('Salón privado');assert.equal(f.writes.length,1);
 const added=await f.ensure('  Terraza  ');assert.equal(added.id,'new');assert.equal(f.rows.length,3);assert.equal(f.rows[1].restaurant_id,'another');assert.equal(f.rows[2].restaurant_id,'restaurant');assert(f.reads.every(r=>r.rid==='restaurant'&&r.table==='v2_reservation_areas'&&r.active===false));
});
test('concurrent duplicate is reused; permission or save errors cannot create a phantom area',async()=>{
 const raced=fixture([],{race:true});assert.equal((await raced.ensure('Terraza')).id,'concurrent');assert.equal(raced.rows.length,1);
 const denied=fixture([],{role:'lectura'});await assert.rejects(denied.ensure('Terraza'),/acceso/);assert.equal(denied.writes.length,0);assert.equal(denied.reads.length,0);
 const failed=fixture([],{fail:true});await assert.rejects(failed.ensure('Terraza'),e=>e.code==='NETWORK');assert.equal(failed.rows.length,0);
});
