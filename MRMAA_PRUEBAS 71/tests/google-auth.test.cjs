const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.UNOMESA_AUTH_TEST_ROOT || process.cwd();
const ts=require(path.join(root,'node_modules/typescript'));
const {PGlite}=require(path.join(root,'node_modules/@electric-sql/pglite'));
const uid='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222';
const claims={sub:uid,session_id:sid,amr:[{method:'oauth'}]};
const tokenFor=x=>'x.'+Buffer.from(JSON.stringify(x)).toString('base64url')+'.x';
const user={id:uid,email:'owner@example.test',email_confirmed_at:'2026-09-29',identities:[{provider:'google'}],factors:[],user_metadata:{full_name:'Verified Google Name'}};
function load(relative,overrides={},env={}){
 const cache={};
 function mod(file){
  file=path.resolve(root,file);if(cache[file])return cache[file].exports;
  const m={exports:{}};cache[file]=m;
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const req=name=>{if(name in overrides)return overrides[name];if(name.startsWith('@/'))return mod(name.slice(2)+'.ts');if(name.startsWith('./'))return mod(path.resolve(path.dirname(file),name+'.ts'));return require(require.resolve(name,{paths:[root]}));};
  vm.runInNewContext(source,{module:m,exports:m.exports,require:req,console,Buffer,URL,atob,TextEncoder,process:{env:{NEXT_PUBLIC_GOOGLE_AUTH_ENABLED:'true',...env}},setTimeout,clearTimeout},{filename:file});return m.exports;
 }
 return mod(relative);
}
async function apiTests(){
 let accepted=true,mfa=true,active=true,support=false,rpcCalls=[],profileState='needs_profile';
 const admin={rpc:async(name,args)=>{rpcCalls.push([name,args]);return {data:name==='v2_google_registration_state'?profileState:name==='v2_google_start_trial'?{restaurant_id:'existing',created:true}:name==='v2_email_challenge'?'verified':true,error:null}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{enabled:true},error:null})})})}),auth:{admin:{mfa:{deleteFactor:async()=>({error:null})}}}};
 let currentUser={...user};
 const client={auth:{getUser:async()=>({data:{user:accepted?currentUser:null},error:accepted?null:Error('bad token')})},rpc:async name=>({data:name==='v2_session_alive'?active:name==='v2_is_support_agent'?support:mfa,error:null})};
 class BillingError extends Error{constructor(message,status=400){super(message);this.status=status}}
 const mocks={'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}},'@/lib/billing-server':{BillingError,requestBody:async req=>req.payload,serverClients:()=>({admin,client})},'@/lib/mfa':{requireVerifiedMfa:async()=>{if(!mfa)throw Error('MFA')}},nodemailer:{createTransport:()=>({sendMail:async()=>{},close(){}})},'@/lib/mail-brand':{mailSender:()=> 'passcode@example.test',brandMail:x=>x},'@/lib/site-origin':{siteOrigin:()=> 'https://unomesa.test'}};
 const api=load('app/api/auth/google/profile/route.ts',mocks);
 const request=(payload={},claimsValue=claims)=>({payload,headers:new Headers({authorization:'Bearer '+tokenFor(claimsValue)}),url:'https://unomesa.test/api/auth/google/profile'});
 const data={full_name:'Owner Example',restaurant_name:'Restaurant',phone:'+50255555555',country:'GT',language:'es',currency:'GTQ',accepted:true,legal_version:'2026-09-10',user_id:'evil',restaurant_id:'evil',plan_code:'basic',trial_exempt:true};
 assert.equal((await api.GET(request())).body.state,'needs_profile');
 accepted=false;rpcCalls=[];assert.equal((await api.POST(request(data))).status,401);assert.equal(rpcCalls.length,0);accepted=true;
 mfa=false;assert.equal((await api.POST(request(data))).status,403);assert.equal(rpcCalls.length,0);mfa=true;
 assert.equal((await api.POST(request(data,{...claims,amr:[{method:'recovery'}]}))).status,401);
 currentUser={...user,identities:[{provider:'email'}]};assert.equal((await api.POST(request(data))).status,401);currentUser={...user};
 assert.equal((await api.POST(request({...data,accepted:false}))).status,400);
 assert.equal((await api.POST(request({...data,country:'XX'}))).status,400);
 assert.equal((await api.POST(request({...data,legal_version:'old'}))).status,400);
 assert.equal((await api.POST(request({accepted:true,legal_version:'2026-09-10',language:'en',currency:'USD',country:null}))).status,200);
 rpcCalls=[];assert.equal((await api.POST(request(data))).status,200);
 const args=rpcCalls.find(([n])=>n==='v2_google_start_trial')[1];assert.equal(args.p_user,uid);assert.equal(args.p_session,sid);assert.equal(args.p_data.country,'Guatemala');assert.equal(args.p_data.full_name,'Verified Google Name');assert.equal('phone' in args.p_data,false);assert.equal('restaurant_name' in args.p_data,false);assert.equal('plan_code' in args.p_data,false);assert.equal('trial_exempt' in args.p_data,false);assert.equal('restaurant_id' in args.p_data,false);
 const disabled=load('app/api/auth/google/profile/route.ts',mocks,{NEXT_PUBLIC_GOOGLE_AUTH_ENABLED:'false'});assert.equal((await disabled.GET(request())).status,503);
 const closed=load('app/api/auth/google/profile/route.ts',mocks,{NEXT_PUBLIC_MRMAA_PUBLIC_SIGNUP:'false'});assert.equal((await closed.GET(request())).body.state,'closed');assert.equal((await closed.POST(request(data))).status,403);profileState='ready';assert.equal((await closed.GET(request())).body.state,'ready');
 const email=load('app/api/security/email/route.ts',mocks,{MRMAA_SMTP_HOST:'smtp.example.test',MRMAA_SMTP_USER:'example',MRMAA_SMTP_PASSWORD:'test-only',SUPABASE_SECRET_KEY:'test-only'});
 assert.equal((await email.GET(request())).body.primary,true);
 rpcCalls=[];assert.equal((await email.POST(request({action:'verify',purpose:'login',code:'123456'}))).status,200);assert.equal(rpcCalls.filter(([n])=>n==='v2_email_challenge').length,1);
 assert.equal((await email.POST(request({action:'account_email_status'}))).status,403); // email changes still require password
 support=true;assert.equal((await email.GET(request())).body.primary,false);assert.equal((await email.POST(request({action:'verify',purpose:'login',code:'123456'}))).status,403);support=false;
 assert.equal((await email.GET(request({}, {...claims,amr:[{method:'recovery'}]}))).body.primary,false);
 active=false;assert.equal((await email.GET(request())).status,503);
 console.log('API authorization, profile validation, rollout flags and MFA regression: PASS');
}
async function sqlTests(direct=false){
 const db=new PGlite();
 await db.exec(`create schema auth; create role anon;create role authenticated;create role service_role;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,invited_at timestamptz,is_anonymous boolean default false,raw_app_meta_data jsonb);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
 create table auth.identities(user_id uuid references auth.users,provider text);
 create table public.v2_device_sessions(session_id uuid primary key references auth.sessions,revoked_at timestamptz);
 create table public.v2_restaurants(id uuid primary key default gen_random_uuid(),owner_id uuid unique references auth.users,name text,phone text,country text,language text,currency text,plan_code text,billing_cycle text,trial_started_at timestamptz,trial_ends_at timestamptz,subscription_status text,access_status text,billing_enforcement_enabled boolean,billing_exempt_user_id uuid,settings jsonb default '{}'::jsonb);
 create table public.v2_members(restaurant_id uuid references public.v2_restaurants,user_id uuid references auth.users,name text,email text,role text,status text,primary key(restaurant_id,user_id));
 create table public.v2_registration_intents(id uuid);
 create table public.v2_legal_acceptances(user_id uuid,restaurant_id uuid,legal_version text,user_agent text,unique(user_id,legal_version));
 create function public.v2_session_is_active(p_session uuid,p_user uuid) returns boolean language sql stable as $$select exists(select 1 from auth.sessions s left join public.v2_device_sessions d on d.session_id=s.id where s.id=p_session and s.user_id=p_user and s.not_after>now() and d.revoked_at is null)$$;
 insert into auth.users values('${uid}','owner@example.test',now(),null,false,'{"provider":"google"}');
 insert into auth.sessions values('${sid}','${uid}',now()+interval '1 hour');
 insert into auth.identities values('${uid}','google');
 insert into public.v2_device_sessions values('${sid}',null);`);
 const migration=fs.readFileSync(path.join(root,'40_REGISTRO_GOOGLE.sql'),'utf8');await db.exec(migration);await db.exec(migration);
 if(direct){const update=fs.readFileSync(path.join(root,'41_GOOGLE_ACCESO_DIRECTO.sql'),'utf8');await db.exec(update);await db.exec(update);}
 const state=async()=> (await db.query('select public.v2_google_registration_state($1,$2) as state',[uid,sid])).rows[0].state;
 const data={full_name:'Owner Example',restaurant_name:'Restaurant',phone:'+50255555555',country:'Guatemala',language:'es',currency:'GTQ',accepted:true,legal_version:'2026-09-10',plan_code:'basic',trial_exempt:true};
 const finish=async(dataValue=data)=>(await db.query('select public.'+(direct?'v2_google_start_trial':'v2_google_finish_registration')+'($1,$2,$3) as result',[uid,sid,JSON.stringify(dataValue)])).rows[0].result;
 assert.equal(await state(),'needs_profile');
 await assert.rejects(finish({...data,accepted:false}),/GOOGLE_INPUT/);assert.equal((await db.query('select count(*)::int n from public.v2_restaurants')).rows[0].n,0);
 await db.exec(`update auth.users set invited_at=now()`);assert.equal(await state(),'blocked');await assert.rejects(finish(),/GOOGLE_ACCESS/);await db.exec('update auth.users set invited_at=null');
 await db.exec(`update auth.users set raw_app_meta_data='{"provider":"email"}'`);assert.equal(await state(),'blocked');await db.exec(`update auth.users set raw_app_meta_data='{"provider":"google"}'`);
 await db.exec('update auth.users set email_confirmed_at=null');assert.equal(await state(),'blocked');await db.exec('update auth.users set email_confirmed_at=now()');
 await db.exec(`update public.v2_device_sessions set revoked_at=now()`);await assert.rejects(finish(),/GOOGLE_ACCESS/);await db.exec('update public.v2_device_sessions set revoked_at=null');
 const first=await finish();assert.equal(first.created,true);const second=await finish();assert.equal(second.created,false);assert.equal(first.restaurant_id,second.restaurant_id);
 const row=(await db.query('select *,extract(epoch from trial_ends_at-trial_started_at) duration from public.v2_restaurants')).rows[0];assert.equal(row.plan_code,'advanced');assert.equal(row.billing_cycle,'month');assert.equal(Number(row.duration),864000);assert.equal(row.billing_exempt_user_id,null);
 if(direct){assert.equal(row.name,'Mi restaurante');assert.equal(row.phone,'');assert.equal(row.settings.google_onboarding.profile_pending,true);assert.equal(row.settings.google_onboarding.direct_dashboard,true);}
 assert.equal((await db.query('select count(*)::int n from public.v2_legal_acceptances')).rows[0].n,1);
 await db.exec(`update public.v2_restaurants set plan_code='basic',subscription_status='active',billing_exempt_user_id='${uid}'`);const before=(await db.query('select * from public.v2_restaurants')).rows[0];await finish();assert.deepEqual((await db.query('select * from public.v2_restaurants')).rows[0],before);
 await db.exec(`update public.v2_members set status='inactivo'`);assert.equal(await state(),'blocked');await assert.rejects(finish(),/GOOGLE_ACCESS/);
 await db.exec(`update public.v2_members set status='invitado'`);assert.equal(await state(),'blocked');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(finish(),/permission denied/);await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal(await state(),'blocked');await db.exec('reset role');
 await db.close();console.log((direct?'Direct dashboard':'Original Google')+' SQL: atomicity, 10-day trial, idempotence, guards, permissions and pilot/paid-plan preservation: PASS');
}
(async()=>{await apiTests();await sqlTests();await sqlTests(true)})().catch(e=>{console.error(e);process.exitCode=1});
