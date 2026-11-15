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
const team=fs.readFileSync('58_USUARIOS_SUCURSALES.sql','utf8');
const migrate=async db=>{await db.exec(sql);await db.exec(migration);await db.exec(`alter table v2_members add column invited_at timestamptz,add column last_invited_at timestamptz,add column invite_token_hash text;create function v2_plan_user_limit(p_restaurant uuid)returns integer language sql as $$select coalesce((settings->>'team_limit')::int,15) from public.v2_restaurants where id=p_restaurant$$;`);await db.exec(team)};
const capacity=(db,n)=>db.query('select v2_branch_apply_capacity($1,$2,$3,$4,$5)',[root,lease,'apple','subscription',n]);
const create=async(db,name='Branch',opts={},source=null,key=uuid(),user=owner)=>(await db.query('select v2_branch_create($1,$2,$3,$4,$5,$6) rid',[root,user,key,name,source,opts])).rows[0].rid;
const step=(db,job)=>db.query('select v2_branch_copy_step($1) result',[job]);
async function finish(db,rid){const j=(await db.query('select id from v2_branch_jobs where target_id=$1',[rid])).rows[0].id;for(let i=0;i<100;i++){const s=(await step(db,j)).rows[0].result;if(s.status==='done')return s;}throw new Error('COPY_DID_NOT_FINISH');}
const archive=(db,rid)=>db.query('select v2_branch_archive($1,$2,true)',[rid,owner]);
const trash=(db,rid,restore=false,user=owner,company=root)=>db.query('select v2_branch_trash($1,$2,$3,$4)',[company,rid,user,restore]);
const rename=(db,rid,name)=>db.query('select v2_branch_rename($1,$2,$3,$4)',[root,rid,owner,name]);
const expire=(db,rid)=>db.query("update v2_branches set deleted_at=now()-interval '31 days',purge_after=now()-interval '1 day' where restaurant_id=$1",[rid]);
const selected=(id,role='operacion',expected)=>({id,selected:true,role,...(expected!==undefined?{expected}:{})});
const apply=(db,uid,changes,mode='edit',actor=owner,context=root,h='a'.repeat(64))=>db.query('select v2_team_apply($1,$2,$3,$4,$5,$6,$7,$8) r',[context,actor,uid,'Employee',uid+'@example.test',changes,mode,h]);
const catalog=async(db,actor=owner,context=root,user=null,after=null,search='')=>(await db.query('select v2_team_catalog($1,$2,$3,$4,$5,$6) r',[context,actor,user,search,after?.name||null,after?.id||null])).rows[0].r;
const invitation=async(db,context,user,h,action='preview',claim=null)=>(await db.query('select v2_team_invitation($1,$2,$3,$4,$5) r',[context,user,h,action,claim])).rows[0].r;
test('58 install repeatable, preserves existing data and billing exemptions; 85-location search and cursor pagination',async()=>{const db=await setup();try{
 await migrate(db);await capacity(db,85);for(let i=1;i<=84;i++)await create(db,`Branch ${String(i).padStart(3,'0')}`);
 await db.query('update v2_restaurants set billing_exempt_user_id=owner_id where id=$1',[root]);
 const before=(await db.query('select to_jsonb(r) r from v2_restaurants r order by id')).rows;
 const members=(await db.query('select to_jsonb(m) m from v2_members m order by restaurant_id,user_id')).rows;
 await db.exec(team);assert.deepEqual((await db.query('select to_jsonb(r) r from v2_restaurants r order by id')).rows,before);assert.deepEqual((await db.query('select to_jsonb(m) m from v2_members m order by restaurant_id,user_id')).rows,members);
 let ids=[],next=null;do{const page=await catalog(db,owner,root,null,next);assert(page.items.length<=25);ids.push(...page.items.map(x=>x.id));next=page.next;}while(next);
 assert.equal(new Set(ids).size,85);assert.equal(ids.length,85);assert.equal((await catalog(db,owner,root,null,null,'Branch 084')).items.length,1);
 const user=uuid();await apply(db,user,ids.map((id,i)=>selected(id,i%2?'lectura':'gerente')),'invite');assert.equal((await db.query('select count(*)::int n from v2_members where user_id=$1',[user])).rows[0].n,85);
 assert.equal((await catalog(db,owner,root,user)).assigned_count,85);
}finally{await db.close()}});
test('company and local-admin isolation, private RPC grants, no role escalation by request payload',async()=>{const db=await setup();try{
 await migrate(db);await capacity(db,3);const a=await create(db,'Branch A'),b=await create(db,'Branch B'),local=uuid(),employee=uuid();
 await apply(db,local,[selected(a,'administrador')],'invite');await invitation(db,a,local,'a'.repeat(64),'complete');
 assert.equal((await catalog(db,local,a)).can_manage_branches,false);assert.deepEqual((await catalog(db,local,a)).items.map(x=>x.id),[a]);
 await assert.rejects(apply(db,employee,[selected(a),selected(b)],'invite',local,a),/TEAM_ACCESS/);await assert.rejects(apply(db,employee,[selected(other)],'invite'),/TEAM_ACCESS/);
 await apply(db,employee,[selected(a,'lectura')],'invite',local,a);assert.equal((await db.query('select role from v2_members where user_id=$1',[employee])).rows[0].role,'lectura');
 await assert.rejects(catalog(db,employee,a),/TEAM_ACCESS/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(catalog(db),/permission denied/);await assert.rejects(apply(db,employee,[selected(b)],'invite'),/permission denied/);await assert.rejects(invitation(db,a,employee,'a'.repeat(64)),/permission denied/);await db.exec('reset role')}
}finally{await db.close()}});
test('atomic capacity check, stale edits reject, revocation preserves other memberships and business records',async()=>{const db=await setup();try{
 await migrate(db);await capacity(db,3);const a=await create(db,'Branch A'),b=await create(db,'Branch B'),employee=uuid();
 await db.query("update v2_restaurants set settings='{"+'"team_limit":1'+"}' where id=$1",[b]);
 await assert.rejects(apply(db,employee,[selected(root),selected(a),selected(b)],'invite'),/TEAM_CAPACITY/);
 assert.equal((await db.query('select count(*)::int n from v2_members where user_id=$1',[employee])).rows[0].n,0);
 await apply(db,employee,[selected(root),selected(a,'gerente')],'invite');await invitation(db,root,employee,'a'.repeat(64),'complete');
 await db.query("insert into v2_clients(restaurant_id,name)values($1,'Keep client')",[a]);
 await assert.rejects(apply(db,employee,[selected(a,'lectura',{role:'lectura',status:'activo'})]),/TEAM_CHANGED/);
 await apply(db,employee,[selected(root,'lectura',{role:'operacion',status:'activo'}),{id:a,selected:false,expected:{role:'gerente',status:'activo'}}]);
 assert.equal((await db.query('select count(*)::int n from v2_members where user_id=$1',[employee])).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from v2_clients where restaurant_id=$1',[a])).rows[0].n,1);
 await assert.rejects(apply(db,owner,[selected(root,'lectura')]),/TEAM_OWNER/);
 // Removing the current access is deliberate; the remaining locations stay intact.
 await db.query("update v2_restaurants set settings='{}' where id=$1",[b]);await apply(db,employee,[selected(b,'gerente'),{id:root,selected:false}]);
 assert.deepEqual((await db.query('select restaurant_id,role from v2_members where user_id=$1',[employee])).rows,[{restaurant_id:b,role:'gerente'}]);
 await assert.rejects(apply(db,employee,[{id:b,selected:false}],'edit',owner,b),/TEAM_LAST_LOCATION/);
}finally{await db.close()}});
test('invitation previews and activates assigned locations only; claim single-use; rollback cannot restore revoked membership',async()=>{const db=await setup();try{
 await migrate(db);await capacity(db,3);const a=await create(db,'Branch A'),b=await create(db,'Branch B'),employee=uuid(),h='b'.repeat(64),claim='c'.repeat(64);
 await apply(db,employee,[selected(root),selected(a,'lectura')],'invite',owner,root,h);
 await db.query("insert into v2_members(restaurant_id,user_id,name,email,role,status,invite_token_hash)values($1,$2,'Employee','team@example.test','gerente','invitado',$3)",[other,employee,h]);
 const preview=await invitation(db,a,employee,h);assert.equal(preview.company,'Principal');assert.equal(preview.restaurant_id,a);assert.equal(preview.branches.length,2);assert.equal(preview.branches[0].role,'lectura');
 await invitation(db,a,employee,h,'claim',claim);await assert.rejects(invitation(db,a,employee,h,'claim','d'.repeat(64)),/TEAM_INVITATION/);
 await db.query('delete from v2_members where restaurant_id=$1 and user_id=$2',[root,employee]);
 await invitation(db,a,employee,claim,'rollback',h);assert.equal((await db.query('select count(*)::int n from v2_members where restaurant_id=$1 and user_id=$2',[root,employee])).rows[0].n,0);
 await invitation(db,a,employee,h,'claim',claim);await invitation(db,a,employee,claim,'complete');await assert.rejects(invitation(db,a,employee,claim,'complete'),/TEAM_INVITATION/);
 assert.equal((await db.query('select status from v2_members where restaurant_id=$1 and user_id=$2',[other,employee])).rows[0].status,'invitado');
 assert.equal((await db.query('select count(*)::int n from v2_members where restaurant_id=$1 and user_id=$2',[b,employee])).rows[0].n,0);
}finally{await db.close()}});
test('existing company employee linked without new invitation; archived/trash not assignable; resend rotates exact company invite',async()=>{const db=await setup();try{
 await migrate(db);await capacity(db,4);const a=await create(db,'Branch A'),b=await create(db,'Branch B'),c=await create(db,'Branch C'),employee=uuid(),h='a'.repeat(64);
 await apply(db,employee,[selected(root)],'invite');await invitation(db,root,employee,h,'complete');
 const linked=(await apply(db,employee,[selected(a,'gerente'),selected(b,'lectura')],'invite')).rows[0].r;assert.equal(linked.linked,true);
 assert.equal((await db.query("select count(*)::int n from v2_members where user_id=$1 and status='activo'",[employee])).rows[0].n,3);
 await archive(db,c);await assert.rejects(apply(db,employee,[selected(c)],'invite'),/TEAM_READ_ONLY/);await trash(db,c);assert(!(await catalog(db)).items.some(x=>x.id===c));
 const pending=uuid();await apply(db,pending,[selected(root),selected(a)],'invite');
 await assert.rejects(db.query('select v2_team_resend($1,$2,$3,$4)',[root,owner,pending,'e'.repeat(64)]),/TEAM_RESEND_WAIT/);
 await db.query("update v2_members set last_invited_at=now()-interval '2 minutes' where user_id=$1",[pending]);
 const resent=(await db.query('select v2_team_resend($1,$2,$3,$4) r',[root,owner,pending,'e'.repeat(64)])).rows[0].r;assert.equal(resent.branches.length,2);
 await assert.rejects(invitation(db,root,pending,h),/TEAM_INVITATION/);assert.equal((await invitation(db,root,pending,'e'.repeat(64))).branches.length,2);
}finally{await db.close()}});
