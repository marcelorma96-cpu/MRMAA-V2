const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'../..'),rid='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const layout={areas:[{id:'salon',name:'Salón'}],tables:[1,2].map(n=>({id:'t'+n,areaId:'salon',name:'M'+n,seats:4,shape:'square',x:n*30,y:50,rotation:0}))};
const floor=(tables=['t1'],extra={})=>({table_ids:tables,whole_area_id:null,duration_minutes:120,service_status:'reserved',revision:0,plan_revision:1,...extra});
const payload=(extra={})=>({client_name:'Ana',phone:'555',event_date:'2026-09-30',event_time:'13:00',guests:4,status:'confirmada',deposit:0,...extra});
// Test fixture models the existing RPC contracts. It is not a copy of a customer's database.
async function database({beforeInstall}={}){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select '${id(99)}'::uuid$$;
create function v2_session_alive() returns boolean language sql as $$select true$$;
create function v2_can_read(p uuid) returns boolean language sql as $$select p='${rid}'::uuid$$;
create function v2_effective_membership(p uuid) returns jsonb language sql as $$select jsonb_build_object('role',coalesce(nullif(current_setting('test.role',true),''),'administrador'),'status','activo')$$;
create function v2_account_billing(p uuid) returns jsonb language sql as $$select jsonb_build_object('can_write',true)$$;
create table v2_restaurants(id uuid primary key);
create table v2_clients(id uuid primary key default gen_random_uuid(),restaurant_id uuid,name text,deleted_at timestamptz);
create table v2_reservation_areas(id uuid primary key,restaurant_id uuid);
create table v2_quotes(id uuid primary key default gen_random_uuid(),restaurant_id uuid,quote_number int default 2000,request_id uuid,client_id uuid,client_name text,client_phone text,client_email text,event_date date,event_time time,area text,area_id uuid,guests int,subtotal numeric default 0,discount_pct numeric default 0,tip_pct numeric default 0,total numeric default 0,deposit numeric default 0,payment_method text,balance numeric default 0,internal_notes text,status text default 'pendiente',deleted_at timestamptz);
create table v2_quote_items(id uuid default gen_random_uuid(),quote_id uuid,name text,quantity numeric,position int);
create table v2_reservations(id uuid primary key default gen_random_uuid(),restaurant_id uuid references v2_restaurants,quote_id uuid references v2_quotes,client_id uuid,client_name text,phone text,event_date date,event_time time,area text,area_id uuid,guests int,menu text,subtotal numeric default 0,discount_pct numeric default 0,tip_pct numeric default 0,total numeric default 0,deposit numeric default 0,payment_method text,balance numeric default 0,notes text,status text,deleted_at timestamptz);
insert into v2_restaurants values('${rid}'),('${other}');
create function v2_find_or_create_client(p_restaurant_id uuid,p_name text,p_phone text,p_email text) returns uuid language plpgsql as $$declare cid uuid;begin insert into v2_clients(restaurant_id,name) values(p_restaurant_id,p_name) returning id into cid;return cid;end$$;
create function v2_save_quote_once(p_restaurant uuid,p_quote_id uuid,p_request_id uuid,p_payload jsonb,p_items jsonb) returns table(id uuid,quote_number int) language plpgsql as $$declare q v2_quotes;begin
 if p_quote_id is null then
 select * into q from v2_quotes where restaurant_id=p_restaurant and request_id=p_request_id;
 if found then return query select q.id,q.quote_number;return;end if;
 insert into v2_quotes(restaurant_id,request_id) values(p_restaurant,p_request_id) returning * into q;
 else select * into q from v2_quotes where v2_quotes.id=p_quote_id and restaurant_id=p_restaurant;end if;
 q:=jsonb_populate_record(q,p_payload);
 update v2_quotes set client_name=q.client_name,event_date=q.event_date,event_time=q.event_time,guests=q.guests where v2_quotes.id=q.id;
 delete from v2_quote_items where quote_id=q.id;
 insert into v2_quote_items(quote_id,name,quantity,position) select q.id,x->>'name',(x->>'quantity')::numeric,n from jsonb_array_elements(p_items) with ordinality a(x,n);
 update v2_reservations set event_date=q.event_date,event_time=q.event_time,guests=q.guests where quote_id=q.id;
 return query select q.id,q.quote_number;end$$;
create function v2_link_reservation_quote(p_restaurant uuid,p_reservation uuid,p_quote uuid) returns jsonb language plpgsql as $$begin
 if not exists(select 1 from v2_quotes where id=p_quote and restaurant_id=p_restaurant) or not exists(select 1 from v2_reservations where id=p_reservation and restaurant_id=p_restaurant) then raise exception 'LINK_ACCESS';end if;
 update v2_reservations set quote_id=p_quote,status='confirmada' where id=p_reservation;return jsonb_build_object('id',p_reservation);end$$;
create function v2_save_reservation_quote(p_restaurant uuid,p_quote_id uuid,p_request_id uuid,p_payload jsonb,p_items jsonb,p_reservation uuid) returns jsonb language plpgsql as $$declare v jsonb;begin
 select to_jsonb(f) into v from v2_save_quote_once(p_restaurant,p_quote_id,p_request_id,p_payload,p_items) f;
 perform v2_link_reservation_quote(p_restaurant,p_reservation,(v->>'id')::uuid);return v;end$$;
`);
// These fixture functions deliberately use unqualified table names; set their own search path as existing installed functions do.
await db.exec(`alter function v2_save_quote_once(uuid,uuid,uuid,jsonb,jsonb) set search_path=public;alter function v2_save_reservation_quote(uuid,uuid,uuid,jsonb,jsonb,uuid) set search_path=public;alter function v2_link_reservation_quote(uuid,uuid,uuid) set search_path=public;alter function v2_find_or_create_client(uuid,text,text,text) set search_path=public;`);
if(beforeInstall)await beforeInstall(db);
for(const name of ['43_PLANO_MESAS.sql','44_PLANO_FORMULARIOS_COTIZACIONES.sql'])await db.exec(fs.readFileSync(path.join(root,name),'utf8'));
await rpc(db,'v2_floor_save_layout',[rid,0,layout]);return db;}
async function rpc(db,name,args){return (await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args.map(x=>x&&typeof x==='object'?JSON.stringify(x):x))).rows[0].result;}
const save=(db,n,data=payload(),selection=floor(),isNew=true)=>rpc(db,'v2_floor_save_reservation',[rid,id(n),isNew,data,selection]);
const quote=(db,n,selection=floor(),data=payload(),reservation=null)=>rpc(db,'v2_floor_save_quote',[rid,n?id(n):null,require('node:crypto').randomUUID(),data,[{name:'Menú',quantity:2}],reservation,selection]);
const expected=(extra={})=>({event_date:'2026-09-30',event_time:'13:00',guests:4,...extra});
async function snapshot(db){return (await db.query(`select jsonb_build_object('reservations',(select jsonb_agg(r order by id) from v2_reservations r),'quotes',(select jsonb_agg(q order by id) from v2_quotes q),'items',(select jsonb_agg(i order by id) from v2_quote_items i),'seats',(select jsonb_agg(s order by reservation_id) from v2_floor_seatings s),'proposals',(select jsonb_agg(p order by quote_id) from v2_floor_quote_plans p),'clients',(select jsonb_agg(c order by id) from v2_clients c)) as data`)).rows[0].data;}


module.exports={database,rpc,save,quote,expected,snapshot,rid,other,id,layout,floor,payload};
