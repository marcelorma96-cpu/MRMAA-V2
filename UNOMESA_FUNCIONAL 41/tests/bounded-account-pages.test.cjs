const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite'),{createClient}=require('@supabase/supabase-js');
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date,Number,Object,JSON,Error,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n)});return m.exports;}
const quotes=load('lib/quote-data.ts'),security=load('lib/security-data.ts');
function split(s){let depth=0,quoted=false,escape=false,first=0,result=[];for(let i=0;i<s.length;i++){const c=s[i];if(escape){escape=false;continue;}if(c==='\\'&&quoted){escape=true;continue;}if(c==='"')quoted=!quoted;if(!quoted){if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){result.push(s.slice(first,i));first=i+1}}}result.push(s.slice(first));return result;}
const literal=v=>"'"+v.replaceAll("'","''")+"'";
function predicate(s){for(const op of ['and','or'])if(s.startsWith(op+'('))return '('+split(s.slice(op.length+1,-1)).map(predicate).join(' '+op+' ')+')';const match=s.match(/^([a-z_]+)\.(eq|neq|gt|lt|gte|lte|is|ilike)\.(.*)$/);assert(match,'unsupported filter '+s);let [,f,op,v]=match;assert(/^[a-z_]+$/.test(f));if(v.startsWith('"'))v=JSON.parse(v);if(op==='is'){assert.equal(v,'null');return f+' is null'}return f+' '+({eq:'=',neq:'<>',gt:'>',lt:'<',gte:'>=',lte:'<=',ilike:'ilike'}[op])+' '+literal(v);}
test('25-row quote and 10-row audit keysets cover complete filtered histories, ties and null dates in both orders',async()=>{
 const db=new PGlite(),restaurant='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',seen=[];
 try{
 await db.exec(`create table v2_quotes(id uuid primary key,restaurant_id uuid,quote_number int,client_name text,client_phone text,event_date date,event_time time,area text,total numeric,status text,created_at timestamptz,deleted_at timestamptz);
 create table v2_audit_log(id bigint primary key,restaurant_id uuid,table_name text,action text,changed_by uuid,actor_name text,actor_role text,changed_at timestamptz,old_data jsonb,new_data jsonb);`);
 for(let i=1;i<=87;i++){await db.query('insert into v2_quotes values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[
  '00000000-0000-4000-8000-'+String(i).padStart(12,'0'),i===86?other:restaurant,Math.floor(i/3),i%2?'Ana':'Ben','5555',i>68?null:'2026-10-'+String(1+i%10).padStart(2,'0'),i%4===0?null:'12:00','Salon',100,i%3?'pendiente':'confirmada','2026-09-'+String(1+i%4).padStart(2,'0')+'T10:00:00Z',i===87?'2026-09-01':null]);
 await db.query('insert into v2_audit_log values($1,$2,$3,$4,null,$5,$6,$7,null,$8)',[i,i===86?other:restaurant,'v2_quotes','UPDATE','Owner','admin','2026-10-'+String(1+i%4).padStart(2,'0')+'T12:00:00Z',JSON.stringify({quote_number:i})]);}
 const client=createClient('https://fixture.supabase.co','fake-key',{auth:{persistSession:false},global:{fetch:async input=>{
  const url=new URL(input),table=url.pathname.split('/').pop();assert(['v2_quotes','v2_audit_log'].includes(table));
  const conditions=[],order=[];let limit=100;
  for(const [key,value] of url.searchParams){if(key==='select')continue;if(key==='limit'){limit=Number(value);continue}if(key==='order'){for(const term of value.split(',')){const [f,d,n]=term.split('.');order.push(f+' '+d+(n==='nullslast'?' nulls last':n==='nullsfirst'?' nulls first':''));}continue;}if(key==='or'){conditions.push(predicate('or'+value));continue;}conditions.push(predicate(key+'.'+value));}
  const sql=`select * from ${table} where ${conditions.join(' and ')} order by ${order.join(',')} limit ${limit}`;seen.push({table,limit,search:url.search});
  const {rows}=await db.query(sql);return new Response(JSON.stringify(rows),{headers:{'Content-Type':'application/json'}});
 }}});
 for(const field of ['created_at','quote_number','event_date'])for(const ascending of [false,true])for(const search of ['', 'Ana']){
  const ids=[];let cursor=null;
  for(let page=0;page<10;page++){const got=await quotes.readQuoteSummaryPage(client,restaurant,search,'2026-10-09',field,ascending,cursor,new AbortController().signal);assert(got.rows.length<=25);ids.push(...got.rows.map(r=>r.id));if(!got.has_more)break;assert.equal(got.next.id,got.rows.at(-1).id);cursor=got.next;}
  const dir=ascending?'asc':'desc',fields=field==='event_date'?['event_date','event_time','quote_number','id']:field==='quote_number'?['quote_number','id']:['created_at','quote_number','id'];
  const expected=await db.query(`select id from v2_quotes where restaurant_id=$1 and deleted_at is null ${search?"and client_name ilike '%Ana%'":''} order by ${fields.map(f=>f+' '+dir+' nulls last').join(',')}`,[restaurant]);
  assert.deepEqual(ids,expected.rows.map(r=>r.id),field+' '+dir+' '+search);assert.equal(new Set(ids).size,ids.length);
 }
 const audits=[];let after=null;
 for(let page=0;page<15;page++){const got=await security.readAuditPage(client,restaurant,after,new AbortController().signal);assert(got.rows.length<=10);audits.push(...got.rows.map(r=>r.id));if(!got.has_more)break;after=got.next;}
 const expected=await db.query('select id from v2_audit_log where restaurant_id=$1 order by changed_at desc,id desc',[restaurant]);assert.deepEqual(audits,expected.rows.map(r=>r.id));
 assert(seen.every(x=>x.limit===(x.table==='v2_quotes'?26:11)));assert(seen.every(x=>!x.search.includes('offset')));
 const ctrl=new AbortController();ctrl.abort();const before=seen.length;await assert.rejects(quotes.readQuoteSummaryPage(client,restaurant,'','2026-10-09','created_at',false,null,ctrl.signal));assert.equal(seen.length,before);
 }finally{await db.close()}
});
test('trash requests only 10 records at the correct offset; errors never look like an empty successful page',async()=>{
 let payload;const client={rpc:(_name,p)=>{payload=p;return{abortSignal:async()=>({data:[{row_data:{id:11},total_count:23}],error:null})}}};
 const result=await security.readTrashPage(client,'restaurant','Ana',2,new AbortController().signal);assert.equal(payload.p_limit,10);assert.equal(payload.p_offset,10);assert.equal(result.total,23);
 await assert.rejects(security.readTrashPage({rpc:()=>({abortSignal:async()=>({error:new Error('network')})})},'restaurant','',1,new AbortController().signal),/network/);
});
