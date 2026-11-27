require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {permissionsFor}=require('../lib/permissions.ts');
const {employeePayload,catalogSnapshot,saveScheduleCatalog}=require('../lib/schedule-catalog.ts');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tenant=id(1),foreign=id(2),area=id(3),foreignArea=id(4);
test('only active administrators and managers have the new catalog permission',()=>{
 for(const role of ['administrador','admin','gerente'])assert.equal(permissionsFor(role,'activo').canManageScheduleCatalog,true);
 for(const role of ['operacion','lectura','soporte_editor','soporte_lectura','','owner'])assert.equal(permissionsFor(role,'activo').canManageScheduleCatalog,false);
 for(const role of ['administrador','gerente'])for(const status of ['pendiente','inactivo',null])assert.equal(permissionsFor(role,status).canManageScheduleCatalog,false);
 assert.equal(permissionsFor('soporte_editor','activo').canManageSchedules,true,'existing support scheduling stays unchanged');
 assert.equal(permissionsFor('gerente','activo').canManageSettings,false,'no general settings access');
});
test('client rechecks membership before saving and validates employee details',async()=>{
 assert.deepEqual(employeePayload({name:' Ana ',employee_code:' 01 ',phone:' 123 ',area_id:'',active:true}),{name:'Ana',employee_code:'01',phone:'123',area_id:null,active:true});
 assert.equal(employeePayload({name:' ',employee_code:'',phone:'',area_id:'',active:true}),null);
 let calls=0,role='operacion';
 const client={auth:{getUser:async()=>({data:{user:{id:id(9)}}})},rpc:async(name)=>{
   if(name==='v2_effective_membership')return{data:{role,status:'activo'}};
   calls++;return{data:{id:id(10)}};
 }};
 await assert.rejects(saveScheduleCatalog(client,tenant,'employee',id(10),{},null));assert.equal(calls,0);
 role='gerente';await saveScheduleCatalog(client,tenant,'employee',id(10),{},null);assert.equal(calls,1);
});
test('database RPC enforces roles, branch, MFA, billing, concurrency and keeps schedule history',async()=>{
 const db=await PGlite.create();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.v2_effective_membership(uuid) returns jsonb language sql stable as $$select jsonb_build_object('role',current_setting('test.role',true),'status',current_setting('test.status',true))$$;
 create function public.v2_session_alive() returns boolean language sql stable as $$select current_setting('test.session',true)='yes'$$;
 create function public.v2_mfa_session_allowed() returns boolean language sql stable as $$select current_setting('test.mfa',true)='yes'$$;
 create function public.v2_can_read(uuid) returns boolean language sql stable as $$select $1='${tenant}'::uuid$$;
 create function public.v2_plan_has_schedules(uuid) returns boolean language sql stable as $$select current_setting('test.plan',true)='yes'$$;
 create function public.v2_account_billing(uuid) returns jsonb language sql stable as $$select jsonb_build_object('can_write',current_setting('test.paid',true)='yes')$$;
 create table v2_areas(id uuid primary key,restaurant_id uuid,active boolean default true);
 create table v2_employees(id uuid primary key,restaurant_id uuid,name text,employee_code text,phone text,area_id uuid,active boolean);
 create table v2_shifts(id uuid primary key,restaurant_id uuid,name text,start_time time,end_time time,start_text text,end_text text,calculation_start_time time,calculation_end_time time,break_minutes integer,schedule_area_ids uuid[],active boolean);
 create table v2_schedules(id uuid primary key,restaurant_id uuid,employee_id uuid,shift_id uuid,notes text);
 create table test_audit(actor uuid,entity uuid,old_data jsonb,new_data jsonb);
 create function test_audit_change() returns trigger language plpgsql as $$begin insert into public.test_audit values(auth.uid(),new.id,to_jsonb(old),to_jsonb(new));return new;end$$;
 create trigger audit_employee after insert or update on v2_employees for each row execute function test_audit_change();
 create trigger audit_shift after insert or update on v2_shifts for each row execute function test_audit_change();
 alter table v2_employees enable row level security;alter table v2_shifts enable row level security;
 grant usage on schema public,auth to authenticated;grant select,insert,update on v2_employees,v2_shifts to authenticated;
 insert into v2_areas values('${area}','${tenant}',true),('${foreignArea}','${foreign}',true);
 insert into v2_schedules values('${id(30)}','${tenant}','${id(10)}','${id(11)}','Keep history');
 set test.uid='${id(9)}';set test.role='gerente';set test.status='activo';set test.session='yes';set test.mfa='yes';set test.plan='yes';set test.paid='yes';`);
 const sql=fs.readFileSync(path.join(__dirname,'../71_GESTION_DESDE_HORARIOS.sql'),'utf8');await db.exec(sql);await db.exec(sql);
 const before=(await db.query('select * from v2_schedules')).rows;
 const original={name:'Ana',employee_code:'01',phone:'123',area_id:area,active:true};
 const shift={name:'Cierre',start_time:'12:00',end_time:null,start_text:null,end_text:'CIERRE',calculation_start_time:null,calculation_end_time:'22:00',break_minutes:0,schedule_area_ids:[area],active:true};
 const save=async(kind,record,values,expected=null,rid=tenant)=>{
   await db.exec('set role authenticated');try{return(await db.query('select public.v2_save_schedule_catalog($1,$2,$3,$4::jsonb,$5::jsonb) as r',[rid,kind,record,JSON.stringify(values),expected===null?null:JSON.stringify(expected)])).rows[0].r;}finally{await db.exec('reset role')}
 };
 for(const role of ['operacion','lectura','soporte_editor','soporte_lectura','']){
   await db.query("select set_config('test.role',$1,false)",[role]);await assert.rejects(save('employee',id(10),original),{code:'42501'});
 }
 await db.exec("set test.role='gerente'");
 for(const [setting,value] of [['uid',''],['status','inactivo'],['session','no'],['mfa','no'],['plan','no'],['paid','no']]){
   const prev=(await db.query('select current_setting($1) as v',['test.'+setting])).rows[0].v;
   await db.query('select set_config($1,$2,false)',['test.'+setting,value]);await assert.rejects(save('employee',id(10),original),{code:'42501'});
   await db.query('select set_config($1,$2,false)',['test.'+setting,prev]);
 }
 await assert.rejects(save('employee',id(10),original,null,foreign),{code:'42501'});
 await db.exec('set role anon');await assert.rejects(db.query('select public.v2_save_schedule_catalog($1,$2,$3,$4::jsonb)',[tenant,'employee',id(10),JSON.stringify(original)]),{code:'42501'});await db.exec('reset role');
 await assert.rejects(save('employee',id(10),{...original,area_id:foreignArea}),{code:'23514'});
 await assert.rejects(save('employee',id(10),{...original,restaurant_id:foreign}),{code:'22023'});
 await assert.rejects(save('employee',id(10),{...original,name:'  '}),{code:'22023'});
 const employee=await save('employee',id(10),original);assert.equal(employee.name,'Ana');
 await assert.rejects(save('employee',id(10),original),{code:'23505'},'retry cannot insert twice');
 const expected=catalogSnapshot('employee',employee);
 const changed=await save('employee',id(10),{...original,name:'Ana María'},expected);assert.equal(changed.id,employee.id);
 await assert.rejects(save('employee',id(10),{...original,name:'Stale edit'},expected),{code:'40001'});
 await assert.rejects(save('employee',id(45),original,expected),{code:'40001'});
 const inactive=await save('employee',id(10),{...original,active:false},catalogSnapshot('employee',changed));assert.equal(inactive.active,false);
 await save('employee',id(10),original,catalogSnapshot('employee',inactive));
 for(const role of ['admin','administrador']){await db.query("select set_config('test.role',$1,false)",[role]);await save('employee',role==='admin'?id(13):id(14),{...original,employee_code:role});}
 await db.exec("set test.role='gerente'");
 for(const ids of [[foreignArea],[area,area],null])await assert.rejects(save('shift',id(11),{...shift,schedule_area_ids:ids}));
 await assert.rejects(save('shift',id(11),{...shift,start_time:null}),{code:'22023'});
 await assert.rejects(save('shift',id(11),{...shift,break_minutes:-1}),{code:'22023'});
 const turn=await save('shift',id(11),shift);assert.equal(turn.calculation_end_time,'22:00:00');
 const edited=await save('shift',id(11),{...shift,name:'Cierre actualizado',schedule_area_ids:[]},catalogSnapshot('shift',turn));
 assert.equal(edited.id,turn.id);assert.deepEqual(edited.schedule_area_ids,[]);
 await assert.rejects(save('shift',id(11),shift,catalogSnapshot('shift',turn)),{code:'40001'});
 assert.deepEqual((await db.query('select * from v2_schedules')).rows,before,'existing assignments unchanged');
 const audit=(await db.query('select * from test_audit')).rows;assert.equal(audit.length,8);assert(audit.every(a=>a.actor===id(9)));assert.equal(audit[1].old_data.name,'Ana');
 await db.exec('set role authenticated');await assert.rejects(db.exec(`insert into v2_employees(id,name) values('${id(99)}','Forbidden')`),{code:'42501'});await db.exec('reset role');
 }finally{await db.close()}
});
