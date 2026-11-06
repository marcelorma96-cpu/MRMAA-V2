require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite'),{createClient}=require('@supabase/supabase-js');
const {readNumberedPage,readNumberedListPage}=require('../lib/numbered-pagination.ts');
const {readQuoteNumberedPage}=require('../lib/quote-data.ts');
const {readAuditNumberedPage}=require('../lib/security-data.ts');
const {Pagination}=require('../components/pagination.tsx');
function split(s){let depth=0,quoted=false,escape=false,first=0,result=[];for(let i=0;i<s.length;i++){const c=s[i];if(escape){escape=false;continue;}if(c==='\\'&&quoted){escape=true;continue;}if(c==='"')quoted=!quoted;if(!quoted){if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){result.push(s.slice(first,i));first=i+1}}}result.push(s.slice(first));return result;}
const literal=v=>"'"+v.replaceAll("'","''")+"'";
function predicate(s){for(const op of ['and','or'])if(s.startsWith(op+'('))return '('+split(s.slice(op.length+1,-1)).map(predicate).join(' '+op+' ')+')';const match=s.match(/^([a-z_]+)\.(eq|neq|gt|lt|gte|lte|is|ilike)\.(.*)$/);assert(match,'unsupported filter '+s);let [,f,op,v]=match;assert(/^[a-z_]+$/.test(f));if(v.startsWith('"'))v=JSON.parse(v);if(op==='is'){assert.equal(v,'null');return f+' is null'}return f+' '+({eq:'=',neq:'<>',gt:'>',lt:'<',gte:'>=',lte:'<=',ilike:'ilike'}[op])+' '+literal(v);}

test('First/Last buttons jump to the actual endpoints; boundaries, loading and locales stay correct',()=>{
 const buttons=node=>!node||typeof node!=='object'?[]:node.type==='button'?[node]:[node.props?.children].flat(Infinity).flatMap(buttons);
 for(const language of ['es','en'])for(const page of [1,2,5]){
  const calls=[],items=buttons(Pagination({total:103,page,pageSize:25,onPage:p=>calls.push(p),language}));
  const first=items.find(x=>x.props.children===(language==='en'?'First':'Primera'));
  const last=items.find(x=>x.props.children===(language==='en'?'Last':'Última'));
  assert(first&&last);assert.equal(first.props.disabled,page===1);assert.equal(last.props.disabled,page===5);
  first.props.onClick();last.props.onClick();assert.deepEqual(calls,[1,5]);
  assert.equal(items.at(-1),last);
 }
 assert.equal(Pagination({total:25,page:1,pageSize:25,onPage:()=>{}}),null);
 assert.equal(Pagination({total:0,page:1,onPage:()=>{}}),null);
 assert(buttons(Pagination({total:120,page:2,onPage:()=>{},loading:true})).every(b=>b.props.disabled));
});

test('page state resets on search/restaurant/order change and ignores stale responses',()=>{
 let stored;const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('lib/numbered-pagination.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module:m,exports:m.exports,require:name=>{assert.equal(name,'react');return {useState:init=>{if(stored===undefined)stored=init();return [stored,next=>{stored=typeof next==='function'?next(stored):next}];}};}});
 const use=m.exports.useNumberedPagination,old=use('tenant-a:all:asc');old.accept({page:1,total:103,has_more:true});use('tenant-a:all:asc').setPage(5);assert.equal(use('tenant-a:all:asc').page,5);
 const changed=use('tenant-a:Ana:desc');assert.equal(changed.page,1);assert.equal(changed.total,0);old.accept({page:1,total:999,has_more:true});assert.equal(use('tenant-a:Ana:desc').total,0);
 changed.setPage(-1);assert.equal(use('tenant-a:Ana:desc').page,1);assert.equal(use('tenant-b:all:asc').page,1);
});

test('deleted last pages recover directly; failures and cancelled requests never become empty successes',async()=>{
 const signal=new AbortController().signal,calls=[];
 const read=async(from,to)=>{calls.push([from,to]);return {data:Array.from({length:from===100?3:0},(_,i)=>({id:from+i})),count:103,error:null}};
 const result=await readNumberedPage(read,9,25,signal);assert.equal(result.page,5);assert.equal(result.total,103);assert.equal(result.rows.length,3);assert.deepEqual(calls,[[200,224],[100,124]]);
 let n=0;const recovered=await readNumberedPage(async(from,to)=>{if(!n++)return {data:null,count:null,error:{code:'PGRST103'}};return read(from,to)},9,25,signal);assert.equal(recovered.page,5);assert.equal(recovered.rows.length,3);
 const empty=await readNumberedPage(async()=>({data:[],count:0,error:null}),4,25,signal);assert.equal(empty.page,1);assert.equal(empty.total,0);
 await assert.rejects(readNumberedPage(async()=>({data:[],count:null,error:null}),1,25,signal));
 await assert.rejects(readNumberedPage(async()=>({data:[],count:0,error:new Error('denied')}),1,25,signal),/denied/);
 const controller=new AbortController();controller.abort();await assert.rejects(readNumberedPage(()=>{throw new Error('must not read')},1,25,controller.signal),{name:'AbortError'});
});

test('first, last, previous and first again retain tenant, dates, search and sorting with bounded rows',async()=>{
 const db=new PGlite(),rid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',seen=[];
 try{
  await db.exec(`create table v2_clients(id uuid primary key,restaurant_id uuid,name text,phone text,email text,notes text,deleted_at timestamptz);
   create table v2_reservations(id uuid primary key,restaurant_id uuid,client_name text,phone text,event_date date,event_time time,area text,menu text,notes text,status text,deleted_at timestamptz);
   create table v2_quotes(id uuid primary key,restaurant_id uuid,quote_number int,client_name text,client_phone text,event_date date,event_time time,area text,total numeric,status text,created_at timestamptz,deleted_at timestamptz);
   create table v2_audit_log(id bigint primary key,restaurant_id uuid,table_name text,action text,changed_by uuid,actor_name text,actor_role text,changed_at timestamptz,old_data jsonb,new_data jsonb);
   insert into v2_clients select md5(n::text)::uuid,case when n=139 then '${other}' else '${rid}' end::uuid,case when n%2=0 then 'Ana' else 'Ben' end,'555','a@example.test','notes',case when n=140 then now() else null end from generate_series(1,140) n;
   insert into v2_reservations select id,restaurant_id,name,phone,'2026-11-03'::date+(row_number() over(order by id)%3)::int,case when name='Ana' then '12:30'::time else null end,'Salon','Carta',notes,'pendiente',deleted_at from v2_clients;
   insert into v2_quotes select id,restaurant_id,(row_number() over(order by id)/3)::int,client_name,phone,case when event_time is null then null else event_date end,event_time,area,100,status,('2026-10-01'::date+(row_number() over(order by id)%4)::int)::timestamptz,deleted_at from v2_reservations;
   insert into v2_audit_log select n,'${rid}'::uuid,'v2_quotes','UPDATE',null,'Owner','admin','2026-11-01'::timestamptz,null,null from generate_series(1,43) n;`);
  const client=createClient('https://fixture.supabase.co','fake-key',{auth:{persistSession:false},global:{fetch:async input=>{
   const url=new URL(input),table=url.pathname.split('/').pop(),where=[],order=[];let limit=0,offset=0;
   assert(['v2_clients','v2_reservations','v2_quotes','v2_audit_log'].includes(table));
   for(const [key,value] of url.searchParams){
    if(key==='select')continue;if(key==='limit'){limit=Number(value);continue}if(key==='offset'){offset=Number(value);continue}
    if(key==='order'){for(const term of value.split(',')){const [f,d,n]=term.split('.');assert(/^[a-z_]+$/.test(f));order.push(f+' '+d+(n==='nullslast'?' nulls last':n==='nullsfirst'?' nulls first':''));}continue;}
    where.push(key==='or'?predicate('or'+value):predicate(key+'.'+value));
   }
   assert(limit>0&&limit<=50);seen.push({table,offset,limit});
   const condition=where.join(' and '),{rows}=await db.query(`select * from ${table} where ${condition} order by ${order.join(',')} limit ${limit} offset ${offset}`);
   const total=Number((await db.query(`select count(*) n from ${table} where ${condition}`)).rows[0].n);
   return new Response(JSON.stringify(rows),{headers:{'Content-Type':'application/json','Content-Range':`${offset}-${Math.max(offset,offset+rows.length-1)}/${total}`}});
  }}});
  const signal=new AbortController().signal;
  async function navigation(read,sql,size){
   const expected=(await db.query(sql,[rid])).rows.map(r=>r.id),first=await read(1),lastPage=Math.max(1,Math.ceil(expected.length/size));
   assert.equal(first.total,expected.length);assert.deepEqual(first.rows.map(r=>r.id),expected.slice(0,size));
   const before=seen.length,last=await read(lastPage);assert.equal(seen.length-before,1,'last is one window, no traversal');assert.deepEqual(last.rows.map(r=>r.id),expected.slice((lastPage-1)*size));assert.equal(last.has_more,false);
   const previous=await read(Math.max(1,lastPage-1));assert.deepEqual(previous.rows.map(r=>r.id),expected.slice(Math.max(0,lastPage-2)*size,Math.max(1,lastPage-1)*size));
   assert.deepEqual((await read(1)).rows.map(r=>r.id),first.rows.map(r=>r.id));
  }
  for(const search of ['', 'Ana'])await navigation(page=>readNumberedListPage(client,rid,'clients',{search},page,signal),`select id from v2_clients where restaurant_id=$1 and deleted_at is null ${search?"and name='Ana'":''} order by name,id`,50);
  for(const filters of [{mode:'all'},{mode:'all',search:'Ana'},{mode:'single',date:'2026-11-04'},{mode:'range',from:'2026-11-03',to:'2026-11-04'}]){
   const extra=filters.search?"and client_name='Ana'":filters.mode==='single'?"and event_date='2026-11-04'":filters.mode==='range'?"and event_date between '2026-11-03' and '2026-11-04'":'';
   await navigation(page=>readNumberedListPage(client,rid,'reservations',filters,page,signal),`select id from v2_reservations where restaurant_id=$1 and deleted_at is null ${extra} order by event_date,event_time nulls last,id`,50);
  }
  for(const field of ['created_at','quote_number','event_date'])for(const ascending of [true,false])for(const search of ['','Ana']){
   const dir=ascending?'asc':'desc',fields=field==='event_date'?['event_date','event_time','quote_number','id']:field==='quote_number'?['quote_number','id']:['created_at','quote_number','id'];
   await navigation(page=>readQuoteNumberedPage(client,rid,search,'2026-11-03',field,ascending,page,signal),`select id from v2_quotes where restaurant_id=$1 and deleted_at is null ${search?"and client_name='Ana'":''} order by ${fields.map(f=>f+' '+dir+' nulls last').join(',')}`,25);
  }
  await navigation(page=>readAuditNumberedPage(client,rid,page,signal),'select id from v2_audit_log where restaurant_id=$1 order by changed_at desc,id desc',10);
 }finally{await db.close()}
});
