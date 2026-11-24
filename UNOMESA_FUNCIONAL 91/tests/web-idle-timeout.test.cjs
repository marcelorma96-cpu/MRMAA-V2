const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
test('web expires at two hours; input resets deadline; native duration stays unchanged',()=>{
 let app=false;const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/session-activity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({isAppMode:()=>app,APP_IDLE_LIMIT:2592000000})});
 const now=100000000, started=String(now-3600000);
 assert.equal(exports.remainingIdleTime(started,now),3600000);
 assert.equal(exports.remainingIdleTime(String(now-7200000+1),now),1);
 assert.equal(exports.remainingIdleTime(String(now-7200000),now),0);
 assert.equal(exports.remainingIdleSeconds(String(now),now),7200);
 app=true;assert.equal(exports.remainingIdleTime(String(now),now),2592000000);
});
test('server accepts two hours, caps excess, preserves native deadlines and rejects expired/revoked sessions',async()=>{
 const db=new PGlite(),uid='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select '{"session_id":"${sid}"}'::jsonb$$;
 create table v2_device_sessions(session_id uuid primary key,user_id uuid,device text,last_seen_at timestamptz,idle_expires_at timestamptz,revoked_at timestamptz);
 create function v2_session_alive() returns boolean language sql as $$select exists(select 1 from public.v2_device_sessions where session_id='${sid}' and user_id=auth.uid() and revoked_at is null and idle_expires_at>now())$$;
 insert into v2_device_sessions values('${sid}','${uid}','Web',now(),now()+interval '1 hour',null);`);
 await db.exec(fs.readFileSync('62_SESION_WEB_DOS_HORAS.sql','utf8'));
 const scalar=async(s)=>(await db.query(s)).rows[0].ok;
 await db.exec('begin');
 assert.equal(await scalar("select v2_session_touch_active('Web',99999) ok"),true);
 assert.equal(await scalar("select idle_expires_at=now()+interval '2 hours' ok from public.v2_device_sessions"),true);
 await db.exec("update v2_device_sessions set idle_expires_at=now()+interval '30 days'");
 await scalar("select v2_session_touch_active('App',7200) ok");
 assert.equal(await scalar("select idle_expires_at=now()+interval '30 days' ok from public.v2_device_sessions"),true);
 await db.exec("update v2_device_sessions set idle_expires_at=now()-interval '1 second'");
 assert.equal(await scalar("select v2_session_touch_active('Web',7200) ok"),false);
 await db.exec("update v2_device_sessions set idle_expires_at=now()+interval '1 hour',revoked_at=now()");
 assert.equal(await scalar("select v2_session_touch_active('Web',7200) ok"),false);
 await db.exec('commit');
 }finally{await db.close()}
});
