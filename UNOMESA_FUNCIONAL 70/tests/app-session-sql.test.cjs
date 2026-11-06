const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('remembered device cannot revive expired/revoked access or skip MFA; desktop sessions stay untouched',async()=>{
 const db=new PGlite();
 const uid='11111111-1111-4111-8111-111111111111', sid='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select '{"session_id":"${sid}"}'::jsonb$$;
 create table public.v2_device_sessions(session_id uuid primary key,user_id uuid,device text,last_seen_at timestamptz,idle_expires_at timestamptz,revoked_at timestamptz);
 create function public.v2_session_alive() returns boolean language sql as $$select exists(select 1 from public.v2_device_sessions where session_id='${sid}' and user_id=auth.uid() and revoked_at is null and idle_expires_at>now())$$;
 create function public.v2_mfa_session_allowed() returns boolean language sql as $$select coalesce(current_setting('test.mfa',true),'yes')<>'no'$$;
 insert into v2_device_sessions values('${sid}','${uid}','Phone',now(),now()+interval '1 hour',null),('${other}','${uid}','Desktop',now(),now()+interval '1 hour',null);`);
 await db.exec(fs.readFileSync('48_SESION_APP.sql','utf8'));
 const scalar=async(sql)=>(await db.query(sql)).rows[0].ok;
 assert.equal(await scalar("select v2_session_remember_device('Phone') ok"),true);
 assert.equal(await scalar(`select idle_expires_at>now()+interval '29 days' ok from public.v2_device_sessions where session_id='${sid}'`),true);
 assert.equal(await scalar(`select idle_expires_at<now()+interval '2 hours' ok from public.v2_device_sessions where session_id='${other}'`),true);
 await db.exec(`update v2_device_sessions set revoked_at=now() where session_id='${sid}'`);
 assert.equal(await scalar("select v2_session_remember_device('Phone') ok"),false);
 await db.exec(`update v2_device_sessions set revoked_at=null,idle_expires_at=now()-interval '1 minute' where session_id='${sid}'`);
 assert.equal(await scalar("select v2_session_remember_device('Phone') ok"),false);
 await db.exec(`update v2_device_sessions set idle_expires_at=now()+interval '1 hour' where session_id='${sid}';set test.mfa='no';`);
 assert.equal(await scalar("select v2_session_remember_device('Phone') ok"),false);
 assert.equal(await scalar(`select idle_expires_at<now()+interval '2 hours' ok from public.v2_device_sessions where session_id='${sid}'`),true);
 }finally{await db.close()}
});
