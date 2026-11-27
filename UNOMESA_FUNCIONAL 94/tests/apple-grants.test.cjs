const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),ts=require('typescript'),fs=require('node:fs');
const pair=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
const env={NEXT_PUBLIC_APPLE_AUTH_ENABLED:'true',APPLE_LOGIN_TEAM_ID:'TEAM',APPLE_LOGIN_KEY_ID:'KID',APPLE_LOGIN_GRANT_KEY:crypto.randomBytes(32).toString('base64'),APPLE_LOGIN_PRIVATE_KEY:pair.privateKey.export({type:'pkcs8',format:'pem'})};
const nonce='de'.repeat(32), hash=crypto.createHash('sha256').update(nonce).digest('hex'), now=Math.floor(Date.now()/1000);
const payload={sub:'apple-user-123',iss:'https://appleid.apple.com',aud:'com.unomesa.app',nonce:hash,exp:now+300};
const jwt=x=>'test.'+Buffer.from(JSON.stringify(x)).toString('base64url')+'.test';
function mod(file,imports,globals){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>imports[n]||require(n),process:{env},Buffer,URL,URLSearchParams,AbortSignal,...globals});return exports;}
test('exchanges only matching authorization codes; signs the correct Apple client secret and binds the nonce',async()=>{
 let seen;const a=mod('lib/apple-grants-server.ts',{}, {fetch:async(url,init)=>{seen=init.body;assert.equal(url,'https://appleid.apple.com/auth/token');return Response.json({id_token:jwt(payload),refresh_token:'temporary-grant'});}});
 assert.equal((await a.exchangeAppleGrant('one-use-code',jwt(payload),nonce)).subject,payload.sub);
 const [h,b,s]=seen.get('client_secret').split('.');assert(crypto.verify('sha256',Buffer.from(h+'.'+b),{key:pair.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')));
 const claims=JSON.parse(Buffer.from(b,'base64url'));assert.equal(claims.sub,'com.unomesa.app');assert.equal(claims.iss,'TEAM');
 for(const bad of [{sub:'wrong'},{aud:'wrong'},{nonce:'wrong'}])await assert.rejects(a.exchangeAppleGrant('code',jwt({...payload,...bad}),nonce),/APPLE_IDENTITY/);
});
test('grant is encrypted, revoked with the original token only after deletion, and retained for retry on error',async()=>{
 const table=[];let fail=true,count=0;
 const api=mod('lib/apple-grants-server.ts',{}, {fetch:async(url,init)=>{assert.equal(url,'https://appleid.apple.com/auth/revoke');assert.equal(init.body.get('token'),'real-private-grant');count++;return new Response(null,{status:fail?503:200});}});
 const db={from(){return {upsert:async row=>{table.push({id:'g1',...row});return {error:null}},select(){return {is(k,v){return {order(){return {limit:async()=>({data:table.filter(r=>r[k]===v)})}}}}}},update(){return {eq(){return {is(){return {select:async()=>({data:[{id:'g1'}]})}}}}}},delete(){return {eq(){return {is:async()=>{table.splice(0);return {error:null}}}}}}};}};
 await api.saveAppleGrant(db,'uid',payload.sub,'real-private-grant');assert(!JSON.stringify(table).includes('real-private-grant'));assert(!JSON.stringify(table).includes(payload.sub));
 await api.revokeDeletedAppleGrants(db);assert.equal(count,0);table[0].user_id=null;await assert.rejects(api.revokeDeletedAppleGrants(db),/APPLE_RETRY/);
 assert.equal(table.length,1);fail=false;await api.revokeDeletedAppleGrants(db);assert.equal(count,2);assert.equal(table.length,0);
});
test('only a matching validated Supabase identity can receive a session; provider tokens cannot escape',async()=>{
 let saved=0,called=0,captcha=false,sub=payload.sub,failSave=false;
 const route=mod('app/api/auth/apple/session/route.ts',{'next/server':{NextResponse:Response},'@/lib/server-scale':{RequestSafetyError:class extends Error {},readBoundedJson:async r=>r.json(),takeDistributedRateLimit:async()=>{}},'@/lib/apple-grants-server':{exchangeAppleGrant:async()=>({subject:payload.sub,refresh:'not-for-client'}),saveAppleGrant:async()=>{if(failSave)throw Error('storage');saved++;}},'@/lib/billing-server':{serverClients:()=>({admin:{},client:{auth:{signInWithIdToken:async opts=>{called++;assert.equal(opts.provider,'apple');assert.equal(opts.nonce,nonce);return {data:{user:{id:'uid',email_confirmed_at:'today',identities:[{provider:'apple',identity_data:{sub}}]},session:{access_token:'supabase-access',refresh_token:'supabase-refresh'}},error:captcha?{code:'captcha_failed'}:null};}}}})}},{});
 const req=(origin='https://www.unomesa.com')=>new Request('https://www.unomesa.com/api/auth/apple/session',{method:'POST',headers:{Origin:origin},body:JSON.stringify({token:jwt(payload),nonce,code:'one-use'})});
 assert.equal((await route.POST(req('https://wrong.test'))).status,403);assert.equal(called,0);
 sub='different';assert.equal((await route.POST(req())).status,401);assert.equal(saved,0);
 sub=payload.sub;captcha=true;assert.equal((await (await route.POST(req())).json()).error,'captcha_failed');assert.equal(saved,0);
 captcha=false;const ok=await route.POST(req());assert.equal(ok.headers.get('cache-control'),'private, no-store');assert.deepEqual(await ok.json(),{access_token:'supabase-access',refresh_token:'supabase-refresh'});assert.equal(saved,1);
 failSave=true;const failed=await route.POST(req());assert.notEqual(failed.status,200);assert(!(await failed.text()).includes('supabase-refresh'));
});
