const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite'),{createClient}=require('@supabase/supabase-js');
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Date,Number,Object,JSON,Error,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n)});return m.exports;}
const {readAvailableReservationPage:read}=load('lib/quote-data.ts');
function split(s){let depth=0,quoted=false,escape=false,first=0,result=[];for(let i=0;i<s.length;i++){const c=s[i];if(escape){escape=false;continue;}if(c==='\\'&&quoted){escape=true;continue;}if(c==='"')quoted=!quoted;if(!quoted){if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){result.push(s.slice(first,i));first=i+1}}}result.push(s.slice(first));return result;}
const literal=v=>"'"+v.replaceAll("'","''")+"'";
function predicate(s){for(const op of ['and','or'])if(s.startsWith(op+'('))return '('+split(s.slice(op.length+1,-1)).map(predicate).join(' '+op+' ')+')';const m=s.match(/^([a-z_]+)\.(eq|neq|gt|lt|gte|lte|is|ilike)\.(.*)$/);assert(m,s);let [,f,op,v]=m;if(v.startsWith('"'))v=JSON.parse(v);if(op==='is'){assert.equal(v,'null');return f+' is null'}return f+' '+({eq:'=',neq:'<>',gt:'>',lt:'<',gte:'>=',lte:'<=',ilike:'ilike'}[op])+' '+literal(v);}
test('all unlinked reservations paginate completely regardless of status, guests or event time; other tenants and trash stay excluded',async()=>{
 const db=new PGlite(),rid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';try{
 await db.exec('create table v2_reservations(id uuid primary key,restaurant_id uuid,quote_id uuid,client_name text,phone text,event_date date,event_time time,area text,guests int,deposit numeric,status text,deleted_at timestamptz)');
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');for(let n=1;n<=127;n++)await db.query('insert into v2_reservations values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id(n),n===126?other:rid,n===125?id(500):null,n%2?'Ana':'Ben','555','2026-10-'+String(1+n%3).padStart(2,'0'),n%4?'12:00':null,'Garden',n%2?2:85,0,['pendiente','confirmada','cancelada','no_show',null][n%5],n===127?'2026-10-01':null]);
 const seen=[];const client=createClient('https://fixture.supabase.co','fake-key',{auth:{persistSession:false},global:{fetch:async input=>{
  const url=new URL(input);seen.push(url);assert(!url.searchParams.has('status'));assert(!url.searchParams.has('guests'));const where=[],order=[];let limit=0;
  for(const [k,v]of url.searchParams){if(k==='select')continue;if(k==='limit'){limit=Number(v);continue}if(k==='order'){for(const term of v.split(',')){const [f,d,n]=term.split('.');order.push(f+' '+d+(n==='nullslast'?' nulls last':n==='nullsfirst'?' nulls first':''))}continue}where.push(k==='or'?predicate('or'+v):predicate(k+'.'+v))}
  assert.equal(limit,51);const {rows}=await db.query(`select * from v2_reservations where ${where.join(' and ')} order by ${order.join(',')} limit ${limit}`);return new Response(JSON.stringify(rows.map(r=>({...r,event_date:r.event_date instanceof Date?r.event_date.toISOString().slice(0,10):String(r.event_date).slice(0,10)}))),{headers:{'Content-Type':'application/json'}});
 }}});
 for(const [search,date]of [['',''],['Ana',''],['','2026-10-02']]){let after=null,ids=[];for(let page=0;page<5;page++){const result=await read(client,rid,search,date,after,new AbortController().signal);ids.push(...result.rows.map(r=>r.id));if(!result.has_more)break;after=result.next}
  const expected=(await db.query(`select id from v2_reservations where restaurant_id=$1 and quote_id is null and deleted_at is null ${search?"and client_name='Ana'":''} ${date?"and event_date='2026-10-02'":''} order by event_date,event_time nulls last,id`,[rid])).rows.map(r=>r.id);assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,ids.length);
 }
 assert(seen.length>=5);
 }finally{await db.close()}
});
