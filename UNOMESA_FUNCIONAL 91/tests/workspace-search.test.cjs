require('tsx/cjs');
const {test}=require('node:test'),a=require('node:assert/strict');
const {readWorkspaceMatches,globalFilter,searchReady}=require('../lib/workspace-search.ts');
const src={reservations:[{id:'r',quote_id:'q',client_name:'Ana López',phone:'5555-0101',event_date:'2027-02-01',restaurant_id:'a'},{id:'other',quote_id:null,client_name:'Ana López',phone:'',event_date:'2027-02-03',restaurant_id:'a'},{id:'bad',quote_id:'q',client_name:'Ana López',event_date:'2027-02-03',restaurant_id:'b'},{id:'trash',quote_id:'q',client_name:'Ana López',event_date:'2027-02-02',restaurant_id:'a',deleted_at:'x'}],quotes:[{id:'q',quote_number:2240,client_name:'Cotizante',client_phone:null,event_date:'2027-02-01',restaurant_id:'a'},{id:'u',quote_number:2250,client_name:'Ana López',event_date:'2027-02-01',restaurant_id:'a'}],clients:[{id:'c',name:'Ana López',phone:'5555 0101',restaurant_id:'a'}]};
function fixture(term){const calls=[];const db={from(table){const k=table.slice(3),o={k};calls.push(o);const req={select(v){o.cols=v;return this},eq(c,v){o[c]=v;return this},is(c,v){o[c]=v;return this},or(f){o.or=f;return this},in(f,ids){o.related=[f,ids];return this},order(){return this},limit(n){o.cap=n;return this},async abortSignal(signal){a.equal(o.restaurant_id,'a');a.equal(o.deleted_at,null);a(o.cap>0);signal.throwIfAborted();return {data:src[k].filter(x=>x.restaurant_id===o.restaurant_id&&!x.deleted_at&&(o.related?o.related[1].includes(x[o.related[0]]):term==='#2240'?x.quote_number===2240:term==='55550101'?/5555/.test(x.phone||''):(x.name||x.client_name||'').includes(term)))}}};return req}};return {db,calls}}
for(const term of ['#2240','55550101','Ana'])test('branch scoped global lookup: '+term,async()=>{
 const {db,calls}=fixture(term);const result=await readWorkspaceMatches(db,'a',term,new AbortController().signal);const r=result.rows.filter(x=>x.kind==='reservation');
 a.equal(r.find(x=>x.r.id==='r').q.id,'q');
 a(!result.rows.some(x=>['trash','bad'].includes(x.r?.id)));a(!result.rows.some(x=>x.kind==='quote'&&x.q.id==='q'));
 if(term==='Ana'){a(r.some(x=>x.r.id==='other'&&!x.q));a(result.rows.some(x=>x.kind==='customer'));a(result.rows.some(x=>x.kind==='quote'&&x.q.id==='u'))}
 if(term==='#2240'){a.equal(result.rows.length,1);a(calls.some(x=>x.or==='quote_number.eq.2240'));a(!calls.some(x=>x.k==='clients'))}
});
test('short, wildcard-only and empty location do not read; a cancelled search is discarded',async()=>{
 const {db,calls}=fixture('');a(!searchReady('*%'));a(!searchReady('a'));a.equal((await readWorkspaceMatches(db,'','Ana',new AbortController().signal)).rows.length,0);
 const c=new AbortController();c.abort();await a.rejects(readWorkspaceMatches(db,'a','Ana',c.signal));a.equal(calls.length,0);
 a.equal(globalFilter('clients','#2'),'');a.equal(globalFilter('quotes','#2240'),'quote_number.eq.2240');
 const f=globalFilter('clients','a,b_%');a.deepEqual(JSON.parse(f.slice('name.ilike.'.length)),'%a,b\\_\\%%');
});
