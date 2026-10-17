const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');const {randomUUID:uuid}=require('node:crypto');
const root=uuid(),owner=uuid(),other=uuid(),outsider=uuid(),lease=uuid();
const sql=fs.readFileSync('56_MULTISUCURSAL.sql','utf8');
async function setup(){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;create function auth.uid() returns uuid language sql set search_path=public as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table v2_restaurants(id uuid primary key default gen_random_uuid(),owner_id uuid not null unique,name text not null,phone text,country text,language text,currency text,settings jsonb default '{}',plan_code text default 'advanced',billing_cycle text default 'month',trial_started_at timestamptz default now(),trial_ends_at timestamptz default now()+interval '10 days',subscription_status text default 'active',access_status text default 'active',billing_enforcement_enabled boolean default true,billing_exempt_user_id uuid,billing_current_period_end timestamptz default now()+interval '30 days',grace_ends_at timestamptz,export_until timestamptz,deletion_scheduled_at timestamptz,billing_cancel_at_period_end boolean default false);
create table v2_members(restaurant_id uuid references v2_restaurants(id),user_id uuid,name text,email text,role text,status text,primary key(restaurant_id,user_id));
create table v2_billing_state(restaurant_id uuid primary key,lease_token uuid);
create table v2_payment_accounts(restaurant_id uuid primary key,provider text,external_subscription_id text);
create table v2_lemon_checkouts(id uuid primary key);
create function v2_mfa_session_allowed()returns boolean language sql set search_path=public as $$select true$$;
create function v2_is_support_agent()returns boolean language sql set search_path=public as $$select false$$;
create function v2_billing_exempt(p_restaurant uuid)returns boolean language sql set search_path=public as $$select billing_exempt_user_id is not null from v2_restaurants where id=p_restaurant$$;
create function v2_billing_can_write(p_restaurant uuid)returns boolean language sql set search_path=public as $$select subscription_status='active' and billing_current_period_end>now() from v2_restaurants where id=p_restaurant$$;
create function v2_trial_access_allowed(p_restaurant uuid)returns boolean language sql set search_path=public as $$select trial_ends_at>now() or billing_current_period_end is not null from v2_restaurants where id=p_restaurant$$;
create function v2_account_billing(p_restaurant uuid)returns jsonb language sql set search_path=public as $$select to_jsonb(r)||jsonb_build_object('can_write',v2_billing_can_write(r.id),'is_owner',r.owner_id=auth.uid()) from v2_restaurants r where id=p_restaurant and exists(select 1 from v2_members where restaurant_id=r.id and user_id=auth.uid() and status='activo')$$;
create function v2_store_apply(uuid,uuid,text,text,text,text,text,text,text,boolean,timestamptz,boolean,boolean,boolean) returns boolean language sql set search_path=public as $$select true$$;
create table v2_quote_products(id uuid primary key default gen_random_uuid(),restaurant_id uuid references v2_restaurants,name text,price numeric,created_at timestamptz default now(),unique(restaurant_id,name));
create table v2_reservation_areas(id uuid primary key default gen_random_uuid(),restaurant_id uuid references v2_restaurants,name text,capacity integer);
create table v2_clients(id uuid primary key default gen_random_uuid(),restaurant_id uuid references v2_restaurants,name text,phone text,email text,notes text,deleted_at timestamptz,deleted_by uuid,created_at timestamptz default now());
create table v2_floor_plans(restaurant_id uuid primary key references v2_restaurants,revision integer,layout jsonb);
insert into v2_restaurants(id,owner_id,name) values('${root}','${owner}','Principal'),('${other}','${outsider}','Other company');
insert into v2_members values('${root}','${owner}','Owner','owner@example.com','administrador','activo'),('${other}','${outsider}','Other','other@example.com','administrador','activo');
insert into v2_billing_state values('${root}','${lease}');insert into v2_payment_accounts values('${root}','apple','subscription');
`);return db;}
const migration=fs.readFileSync('57_SUCURSALES_PAPELERA.sql','utf8');
const migrate=async db=>{await db.exec(sql);await db.exec(migration)};
const capacity=(db,n)=>db.query('select v2_branch_apply_capacity($1,$2,$3,$4,$5)',[root,lease,'apple','subscription',n]);
const create=async(db,name='Branch',opts={},source=null,key=uuid(),user=owner)=>(await db.query('select v2_branch_create($1,$2,$3,$4,$5,$6) rid',[root,user,key,name,source,opts])).rows[0].rid;
const step=(db,job)=>db.query('select v2_branch_copy_step($1) result',[job]);
async function finish(db,rid){const j=(await db.query('select id from v2_branch_jobs where target_id=$1',[rid])).rows[0].id;for(let i=0;i<100;i++){const s=(await step(db,j)).rows[0].result;if(s.status==='done')return s;}throw new Error('COPY_DID_NOT_FINISH');}
const archive=(db,rid)=>db.query('select v2_branch_archive($1,$2,true)',[rid,owner]);
const trash=(db,rid,restore=false,user=owner,company=root)=>db.query('select v2_branch_trash($1,$2,$3,$4)',[company,rid,user,restore]);
const rename=(db,rid,name)=>db.query('select v2_branch_rename($1,$2,$3,$4)',[root,rid,owner,name]);
const expire=(db,rid)=>db.query("update v2_branches set deleted_at=now()-interval '31 days',purge_after=now()-interval '1 day' where restaurant_id=$1",[rid]);
test('57 repeatable: installing changes no existing business data or exemptions; empty create ready immediately; rename does not create',async()=>{const db=await setup();try{
 await db.exec(sql);await capacity(db,3);const a=await create(db,'North');await finish(db,a);await archive(db,a);
 await db.query("update v2_restaurants set billing_exempt_user_id=owner_id where id=$1",[root]);
 const before=(await db.query('select to_jsonb(r) r from v2_restaurants r order by id')).rows,branches=(await db.query('select to_jsonb(b) b from v2_branches b')).rows;
 await db.exec(migration);await db.exec(migration);assert.deepEqual((await db.query('select to_jsonb(r) r from v2_restaurants r order by id')).rows,before);
 assert.deepEqual((await db.query("select to_jsonb(b)-'deleted_at'-'deleted_by'-'purge_after' b from v2_branches b")).rows,branches);
 const b=await create(db,'Blank');assert.equal((await db.query('select status from v2_branches where restaurant_id=$1',[b])).rows[0].status,'active');
 await rename(db,b,'Updated');assert.equal((await db.query('select name from v2_restaurants where id=$1',[b])).rows[0].name,'Updated');assert.equal((await db.query('select count(*)::int n from v2_branches')).rows[0].n,2);
}finally{await db.close()}});
test('archive then trash, idempotent 30-day deadline, recover to archive without capacity, independent source stays intact',async()=>{const db=await setup();try{
 await migrate(db);await capacity(db,2);const child=await create(db);await db.query("insert into v2_clients(restaurant_id,name)values($1,'Keep all details'),($2,'Principal client')",[child,root]);
 await assert.rejects(trash(db,child),/BRANCH_ARCHIVE_FIRST/);await assert.rejects(trash(db,root),/BRANCH_ACCESS/);await archive(db,child);await trash(db,child);
 const first=(await db.query('select * from v2_branches where restaurant_id=$1',[child])).rows[0];assert.equal((Date.parse(first.purge_after)-Date.parse(first.deleted_at))/86400000,30);
 await trash(db,child);assert.deepEqual((await db.query('select * from v2_branches where restaurant_id=$1',[child])).rows[0],first);
 await assert.rejects(db.query('select v2_branch_archive($1,$2,false)',[child,owner]),/BRANCH_IN_TRASH/);
 assert.equal((await db.query('select v2_trial_access_allowed($1) ok',[child])).rows[0].ok,false);
 await db.query("select set_config('test.uid',$1,false)",[owner]);let list=(await db.query('select v2_branch_list($1,$2,null,null,true) r',[root,''])).rows[0].r;assert(!list.items.some(r=>r.id===child));
 list=(await db.query('select v2_branch_trash_list($1) r',[root])).rows[0].r;assert.equal(list.items[0].id,child);assert.equal(list.items[0].recoverable,true);
 assert.equal((await db.query('select v2_account_billing($1) r',[child])).rows[0].r.branch_can_read,false);
 await db.query("select set_config('test.uid','',false)");await capacity(db,1);await trash(db,child,true);
 assert.equal((await db.query('select status,deleted_at from v2_branches where restaurant_id=$1',[child])).rows[0].status,'archived');assert.equal((await db.query('select count(*)::int n from v2_clients')).rows[0].n,2);
 await assert.rejects(db.query('select v2_branch_archive($1,$2,false)',[child,owner]),/BRANCH_CAPACITY/);
}finally{await db.close()}});
test('owner only; tenant, MFA, public links and RLS reject trash access and early purge',async()=>{const db=await setup();try{
 await db.exec(`create table v2_public_aliases(slug text,restaurant_id uuid);create function v2_public_page(text) returns jsonb language sql as $$select '{"content":"menu"}'::jsonb$$;create function v2_public_submit(text,uuid,jsonb)returns void language sql as $$select null::void$$;`);
 await migrate(db);await db.exec(migration);await capacity(db,2);const child=await create(db);
 await db.query("insert into v2_public_aliases values('branch',$1)",[child]);await archive(db,child);
 await assert.rejects(trash(db,child,false,outsider),/BRANCH_ACCESS/);await assert.rejects(trash(db,child,false,owner,other),/BRANCH_ACCESS/);
 await trash(db,child);assert.equal((await db.query("select v2_public_page('branch') r")).rows[0].r,null);await assert.rejects(db.query("select v2_public_submit('branch',$1,'{}')",[uuid()]),/PUBLIC_NOT_FOUND/);
 assert.equal((await db.query('select v2_branch_purge_step($1) r',[child])).rows[0].r.deleted,false);
 await db.query("select set_config('test.uid',$1,false)",[outsider]);await assert.rejects(db.query('select v2_branch_trash_list($1)',[root]),/BRANCH_ACCESS/);
 await db.query("select set_config('test.uid',$1,false)",[owner]);await db.exec('set role authenticated');await assert.rejects(trash(db,child,true),/permission denied/);await assert.rejects(db.query('select v2_branch_purge_step($1)',[child]),/permission denied/);await db.exec('reset role');
 const actual=require('./fixtures/branch-installed-access.json');await db.exec(`create table v2_support_grants(restaurant_id uuid,agent_id uuid,revoked_at timestamptz,expires_at timestamptz);create function v2_support_role(uuid)returns text language sql as $$select null::text$$;${actual.v2_accessible_restaurants};alter table v2_clients enable row level security;create policy installed_read on v2_clients for select to authenticated using (${actual.client_read_policy});grant usage on schema auth to authenticated;grant select on v2_clients to authenticated;`);
 await db.query("insert into v2_clients(restaurant_id,name)values($1,'Hidden'),($2,'Visible')",[child,root]);await db.exec('set role authenticated');assert.deepEqual((await db.query('select name from v2_clients')).rows,[{name:'Visible'}]);await db.exec('reset role');
 await db.exec('create or replace function v2_mfa_session_allowed()returns boolean language sql as $$select false$$');await assert.rejects(db.query('select v2_branch_trash_list($1)',[root]),/BRANCH_ACCESS/);
}finally{await db.close()}});
test('after 30 days bounded purge removes only deleted child, preserves archived siblings, users, root and copied destination',async()=>{const db=await setup();try{
 await migrate(db);await capacity(db,4);const a=await create(db,'Original'),b=await create(db,'Sibling');await db.query("insert into v2_clients(restaurant_id,name)select $1,'Original '||n from generate_series(1,1400)n",[a]);
 const c=await create(db,'Copied',{clients:true},a);await finish(db,c);await archive(db,a);await archive(db,b);await trash(db,a);await expire(db,a);
 await assert.rejects(trash(db,a,true),/BRANCH_TRASH_EXPIRED/);
 let complete=false;for(let i=0;i<15;i++){const r=(await db.query('select v2_branch_purge_step($1) r',[a])).rows[0].r;if(r.deleted){complete=true;break}}
 assert(complete);assert.equal((await db.query('select count(*)::int n from v2_restaurants where id=$1',[a])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from v2_clients where restaurant_id=$1',[c])).rows[0].n,1400);
 assert.equal((await db.query('select count(*)::int n from v2_restaurants where id in($1,$2,$3,$4)',[root,other,b,c])).rows[0].n,4);
 assert.equal((await db.query('select status from v2_branch_purge_jobs where branch_id=$1',[a])).rows[0].status,'files');
 assert.equal((await db.query('select v2_branch_purge_step($1) r',[root])).rows[0].r.deleted,false);
 assert.equal((await db.query('select v2_branch_purge_step($1) r',[b])).rows[0].r.deleted,false);
 assert.equal((await db.query('select count(*)::int n from v2_members where restaurant_id=$1',[root])).rows[0].n,1);
}finally{await db.close()}});
test('a pending copy protects its source from trash; optional copied catalogs and map remain independent',async()=>{const db=await setup();try{
 await migrate(db);await capacity(db,4);const a=await create(db,'Source');await db.query("insert into v2_clients(restaurant_id,name)values($1,'Client')",[a]);const b=await create(db,'Copy',{clients:true},a);
 await archive(db,a);await assert.rejects(trash(db,a),/BRANCH_COPY_IN_USE/);await finish(db,b);await trash(db,a);
 assert.equal((await db.query('select count(*)::int n from v2_clients where restaurant_id=$1',[b])).rows[0].n,1);
}finally{await db.close()}});
