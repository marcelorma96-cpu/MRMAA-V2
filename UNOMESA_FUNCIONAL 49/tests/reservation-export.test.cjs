require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readReservationExport}=require('../lib/reservation-export.ts');
test('export exclusion handles all status spellings and null without changing saved rows',async()=>{
 const rows=['confirmada','cancelada',' CANCELADO ','cancelled','Canceled',null,'pendiente',''].map((status,id)=>({id,status,guests:5,deposit:100}));
 const before=JSON.stringify(rows),read=async()=>({data:rows,error:null});
 assert.deepEqual((await readReservationExport(read,20,true)).map(r=>r.id),[0,5,6,7]);
 assert.deepEqual(await readReservationExport(read,20,false),rows);
 assert.equal(JSON.stringify(rows),before);
});
test('all-canceled pages do not end pagination or consume the document row limit',async()=>{
 const rows=Array.from({length:2501},(_,id)=>({id,status:id<2000?'cancelada':'confirmada'})),calls=[];
 const read=async(first,last)=>{calls.push([first,last]);return {data:rows.slice(first,last+1),error:null}};
 const result=await readReservationExport(read,501,true);
 assert.equal(result.length,501);assert.equal(result[0].id,2000);assert.equal(result.at(-1).id,2500);
 assert.deepEqual(calls,[[0,999],[1000,1999],[2000,2999]]);
 await assert.rejects(readReservationExport(read,500,true),/500/);
});
test('failed later pages reject the complete export, empty selection succeeds without rows',async()=>{
 const failure=new Error('unavailable');let call=0;
 await assert.rejects(readReservationExport(async()=>++call===1?{data:Array.from({length:1000},()=>({status:'confirmada'})),error:null}:{data:null,error:failure},2000,true),error=>error===failure);
 assert.deepEqual(await readReservationExport(async()=>({data:[{status:'cancelada'}],error:null}),10,true),[]);
});
