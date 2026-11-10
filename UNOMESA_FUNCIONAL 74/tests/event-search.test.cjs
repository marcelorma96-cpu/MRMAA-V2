require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite'),{createClient}=require('@supabase/supabase-js');
const {eventSearchSpec,searchAmount,applyEventSearch,matchesEventSearch,eventSearchOptions}=require('../lib/event-search.ts');
const {readNumberedListPage}=require('../lib/numbered-pagination.ts');
const {readQuoteNumberedPage}=require('../lib/quote-data.ts');
const {readReservationExport}=require('../lib/reservation-export.ts');
const rid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',today='2026-11-06';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
// PostgreSQL date fields are YYYY-MM-DD strings in the Supabase response.
const apiRow=row=>({...row,event_date:row.event_date instanceof Date?row.event_date.toISOString().slice(0,10):row.event_date});

// Read-only PostgREST transport: evaluate the actual generated filters in PostgreSQL.
function split(value){let depth=0,quoted=false,escape=false,start=0,out=[];for(let i=0;i<value.length;i++){const c=value[i];if(escape){escape=false;continue}if(c==='\\'&&quoted){escape=true;continue}if(c==='"')quoted=!quoted;if(!quoted){if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){out.push(value.slice(start,i));start=i+1}}}out.push(value.slice(start));return out;}
const literal=value=>"'"+value.replaceAll("'","''")+"'";
function predicate(value){for(const op of ['and','or'])if(value.startsWith(op+'('))return '('+split(value.slice(op.length+1,-1)).map(predicate).join(' '+op+' ')+')';
 const match=value.match(/^([a-z_]+)\.(eq|neq|gt|lt|gte|lte|is|ilike)\.(.*)$/);assert(match,value);let [,field,op,v]=match;if(v.startsWith('"'))v=JSON.parse(v);if(op==='is'){assert.equal(v,'null');return field+' is null'}return field+' '+({eq:'=',neq:'<>',gt:'>',lt:'<',gte:'>=',lte:'<=',ilike:'ilike'}[op])+' '+literal(v);
}
function clientFor(db,reads){return createClient('https://fixture.supabase.co','fake-key',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
 assert(!options?.method||options.method==='GET');const url=new URL(input),table=url.pathname.split('/').pop();assert(['v2_reservations','v2_quotes'].includes(table));
 const where=[],order=[];let offset=0,limit=0;
 for(const [key,value] of url.searchParams){if(key==='select')continue;if(key==='limit'){limit=Number(value);continue}if(key==='offset'){offset=Number(value);continue}if(key==='order'){for(const term of value.split(',')){const [f,d,n]=term.split('.');assert(/^[a-z_]+$/.test(f));assert(['asc','desc'].includes(d));order.push(f+' '+d+(n==='nullslast'?' nulls last':n==='nullsfirst'?' nulls first':''));}continue}where.push(key==='or'?predicate('or'+value):predicate(key+'.'+value));}
 assert(limit>0&&limit<=1000);reads.push({table,offset,limit});const condition=where.join(' and ');
 const {rows}=await db.query(`select * from ${table} where ${condition} order by ${order.join(',')} limit ${limit} offset ${offset}`);
 const count=Number((await db.query(`select count(*) n from ${table} where ${condition}`)).rows[0].n);
 return new Response(JSON.stringify(rows.map(apiRow)),{headers:{'Content-Type':'application/json','Content-Range':`${offset}-${Math.max(offset,offset+rows.length-1)}/${count}`}});
}}});}

test('amounts and dates accept familiar formats without rounding, wildcard interpretation or invalid casts',()=>{
 for(const value of ['500.75','500,75','Q 500.75','USD 500.75','$500.75'])assert.equal(searchAmount(value),500.75);
 for(const value of ['1,250.50','1.250,50','1 250,50'])assert.equal(searchAmount(value),1250.5);
 assert.equal(searchAmount('500.755'),500755,'three grouped digits are thousands, never rounded cents');
 for(const value of ['','-1','1e3','50%','500.7555','1,2,3','NaN','Infinity'])assert.equal(searchAmount(value),null,value);
 assert.equal(eventSearchSpec('31/02/2026').date,null);assert.equal(eventSearchSpec('06/11/2026').date,today);assert.equal(eventSearchSpec(today).date,today);
 assert.equal(eventSearchSpec('7:30 pm').time,'19:30:00');assert.equal(eventSearchSpec('25:00').time,null);
 assert(!eventSearchOptions('reservations').some(([key])=>key==='email'));assert(!eventSearchOptions('quotes').some(([key])=>key==='menu'));
});

test('server pages, exports, local search and SQL summaries agree; reads preserve data and tenant boundaries',async()=>{
 const db=new PGlite(),reads=[],signal=new AbortController().signal;
 try{
  await db.exec(`create role anon;create role authenticated;
   create function v2_can_read(p uuid) returns boolean language sql stable as $$select p='${rid}'::uuid$$;
   create table v2_reservations(id uuid primary key,restaurant_id uuid,client_name text,phone text,event_date date,event_time time,area text,menu text,notes text,status text,deposit numeric,total numeric,balance numeric,guests integer,payment_method text,deleted_at timestamptz);
   create table v2_quotes(id uuid primary key,restaurant_id uuid,quote_number integer,client_name text,client_phone text,client_email text,event_date date,event_time time,area text,customer_note text,internal_notes text,status text,deposit numeric,total numeric,balance numeric,guests integer,payment_method text,created_at timestamptz,deleted_at timestamptz);
   create function v2_reservation_summary(uuid,text,date,date,date,text) returns table(reservations bigint,people numeric,deposits numeric) language sql as $$select 0::bigint,0::numeric,0::numeric$$;
   insert into v2_reservations select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=121 then '${other}' else '${rid}' end::uuid,
    'Cliente '||n,'5555-'||n,'${today}'::date,case when n%2=0 then '19:30' else '12:00' end::time,
    'Salón Azul','Menú Eventos',case when n=1 then 'Oferta 50%_VIP (A,B) "salón"' else 'Sin observaciones' end,
    case when n%10=0 then 'cancelada' else 'confirmada' end,
    case when n<=55 or n>=121 then 500.75 when n<=90 then 0 when n=91 then null else 1250.50 end,
    case when n=80 then 500.75 else 2000 end,750.25,case when n%2=0 then 12 else 24 end,
    case when n%2=0 then 'Tarjeta' else 'Transferencia' end,case when n=122 then now() else null end from generate_series(1,122) n;
   insert into v2_quotes select id,restaurant_id,2000+row_number() over(order by id),client_name,phone,'cliente'||row_number() over(order by id)||'@example.test',
    case when client_name='Cliente 1' then '${today}'::date-1 when client_name='Cliente 2' then '${today}'::date+10 when client_name='Cliente 3' then null else event_date end,event_time,area,notes,'Referencia interna',
    case when client_name in ('Cliente 1','Cliente 2','Cliente 3','Cliente 4') then 'pendiente' else 'convertida' end,deposit,total,balance,guests,payment_method,'2026-11-01'::timestamptz,deleted_at from v2_reservations;
   alter table v2_reservations enable row level security;
   create policy tenant_read on v2_reservations for select to authenticated using (v2_can_read(restaurant_id));
   grant select on v2_reservations to authenticated;`);
  const snapshot=async()=>JSON.stringify([(await db.query('select * from v2_reservations order by id')).rows,(await db.query('select * from v2_quotes order by id')).rows]);
  const before=await snapshot(),migration=fs.readFileSync('63_BUSQUEDA_RESERVACIONES.sql','utf8');await db.exec(migration);await db.exec(migration);assert.equal(await snapshot(),before);
  const client=clientFor(db,reads);
  const cases=[['500.75','deposit','deposit=500.75'],['500,75','deposit','deposit=500.75'],['Q 500.75','all','(deposit=500.75 or total=500.75 or balance=500.75)'],['500.75','total','total=500.75'],['750.25','balance','balance=750.25'],['1,250.50','deposit','deposit=1250.50'],['con anticipo','deposit','deposit>0'],['sin anticipo','deposit','coalesce(deposit,0)=0'],['0','deposit','coalesce(deposit,0)=0'],['Tarjeta','payment_method',"payment_method='Tarjeta'"],['12','guests','guests=12'],['06/11/2026','event_date',`event_date='${today}'`],['7:30 pm','event_time',"event_time='19:30'"],['Azul','area',"area like '%Azul%'"],['50%_VIP (A,B) "salón"','notes',"client_name='Cliente 1'"],['31/02/2026','event_date','false'],['1e3','deposit','false'],['500.755','deposit','false'],['x\",id.neq.null','all','false']];
  for(const [term,field,condition] of cases){
   const expected=(await db.query(`select * from v2_reservations where restaurant_id=$1 and deleted_at is null and ${condition} order by event_date,event_time nulls last,id`,[rid])).rows;
   const first=await readNumberedListPage(client,rid,'reservations',{mode:'single',date:today,search:term,search_field:field},1,signal);
   assert.equal(first.total,expected.length,term+' '+field);assert.deepEqual(first.rows.map(r=>r.id),expected.slice(0,50).map(r=>r.id));
   const last=await readNumberedListPage(client,rid,'reservations',{mode:'single',date:today,search:term,search_field:field},Math.max(1,Math.ceil(expected.length/50)),signal);
   assert.deepEqual(last.rows.map(r=>r.id),expected.slice(Math.max(0,Math.ceil(expected.length/50)-1)*50).map(r=>r.id));
   const exported=await readReservationExport((from,to)=>applyEventSearch(client.from('v2_reservations').select('*').eq('restaurant_id',rid).is('deleted_at',null).eq('event_date',today),'reservations',term,field).order('event_date').order('event_time',{nullsFirst:false}).order('id').range(from,to),200,false);
   assert.deepEqual(exported.map(r=>r.id),expected.map(r=>r.id));
   const summary=(await db.query('select * from v2_reservation_search_summary($1,$2,$3,null,null,$4)',[rid,'single',today,JSON.stringify(eventSearchSpec(term,field))])).rows[0];
   assert.equal(Number(summary.reservations),expected.length);assert.equal(Number(summary.deposits),expected.reduce((n,r)=>n+Number(r.deposit||0),0));assert.equal(Number(summary.people),expected.reduce((n,r)=>n+(r.status==='cancelada'?0:r.guests),0));
   if(!['event_date','notes'].includes(field)){
    const qExpected=(await db.query(`select * from v2_quotes where restaurant_id=$1 and deleted_at is null and ${condition} order by quote_number,id`,[rid])).rows;
    const page=await readQuoteNumberedPage(client,rid,term,today,'quote_number',true,1,signal,field);assert.equal(page.total,qExpected.length);assert.deepEqual(page.rows.map(r=>r.id),qExpected.slice(0,25).map(r=>r.id));
   }
  }
  for(const [term,field,expected] of [['Contactar','status',[4]],['Pendiente','status',[2,3]],['No realizada','status',[1]],['cliente4@example.test','email',[4]],['Referencia interna','notes',Array.from({length:120},(_,i)=>i+1)],['#2004','quote_number',[4]]]){
   const all=(await db.query('select * from v2_quotes where restaurant_id=$1 and deleted_at is null order by quote_number,id',[rid])).rows;
   const local=all.map(apiRow).filter(row=>matchesEventSearch(row,'quotes',term,field,today));assert.deepEqual(local.map(r=>r.id),expected.map(id),term);
   const got=await readQuoteNumberedPage(client,rid,term,today,'quote_number',true,1,signal,field);assert.equal(got.total,expected.length);assert.deepEqual(got.rows.map(r=>r.id),expected.slice(0,25).map(id));
  }
  assert.equal((await readNumberedListPage(client,rid,'reservations',{mode:'range',from:'2026-11-07',to:'2026-11-08',search:'500.75',search_field:'deposit'},1,signal)).total,0);
  assert.equal(await snapshot(),before,'search and repeatable migration must not modify records');
  await db.exec('set role authenticated');
  const denied=(await db.query('select * from v2_reservation_search_summary($1)',[other])).rows[0];assert.equal(Number(denied.reservations),0);
  assert.equal(Number((await db.query('select * from v2_reservation_search_summary($1)',[rid])).rows[0].reservations),120);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from v2_reservation_search_summary($1)',[rid]),/permission denied/);await db.exec('reset role');
  assert(reads.every(r=>r.limit<=1000));
 }finally{await db.close()}
});
