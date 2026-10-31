const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('components/reservations-enhanced.tsx','utf8');
const body=source.split('read: async signal => {')[1].split('\n    },\n    onData:')[0];
const compiled=ts.transpileModule(`async function read(signal:any){${body}}`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
async function run(overrides={}){
 const calls=[],row={id:'new',event_date:'2026-10-10'},result={rows:[{id:'other'}],has_more:true,next:{id:'cursor'}};
 const context={readListPage:async(c,r,t,filters)=>{calls.push(filters);return filters.id?{rows:[row],has_more:false,next:null}:result},supabase:{},restaurantId:'tenant',filterReservationId:null,mode:'single',date:'2026-10-10',today:()=> '2026-10-03',from:'',to:'',querySearch:'',pager:{after:null},newlyCreated:true,focusedReservationId:'new',focusedReservationDate:'2026-10-10',page:1,...overrides};
 const read=Function(...Object.keys(context),compiled+'; return read;')(...Object.values(context));
 return {value:await read(new AbortController().signal),calls};
}
test('conversion shows date list plus created reservation, retaining cursor',async()=>{const {value,calls}=await run();assert.equal(calls[0].id,null);assert.equal(calls[0].date,'2026-10-10');assert.deepEqual(value.rows.map(r=>r.id),['new','other']);assert.deepEqual(value.next,{id:'cursor'});assert.equal(value.has_more,true)});
test('search, other dates and subsequent pages do not force a created reservation',async()=>{for(const override of [{querySearch:'other'},{date:'2026-10-11'},{page:2}]){const {value,calls}=await run(override);assert.equal(calls.length,1);assert.deepEqual(value.rows.map(r=>r.id),['other'])}});
test('existing row is highlighted without duplication or another read',async()=>{const {value}=await run({readListPage:async()=>({rows:[{id:'other'},{id:'new'}],has_more:false,next:null})});assert.deepEqual(value.rows.map(r=>r.id),['new','other'])});
