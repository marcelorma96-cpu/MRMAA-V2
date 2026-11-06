const {test}=require('node:test'),assert=require('node:assert/strict');
const id=n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const token=n=>'header.'+Buffer.from(JSON.stringify({role:'authenticated',sub:id(n)})).toString('base64url')+'.fixture';
const config=()=>({confirmation:'STAGING_ONLY',supabase_url:'https://example.supabase.co',allowed_host:'example.supabase.co',anon_key:'sb_publishable_fixture',concurrency:2,duration_seconds:1,think_ms:100,
 fixtures:[1,2].map(n=>({restaurant_id:id(n),company_root_id:id(n),probe_reservation_id:id(n+10),access_token:token(n)}))});
test('read load probe requires explicit staging host, separate companies and unprivileged sessions',async()=>{
 const {validate}=await import('../verification/read-load.mjs');
 for(const override of [{confirmation:''},{allowed_host:'different.example'},{anon_key:'sb_secret_fixture'},{concurrency:1001},{supabase_url:'http://example.supabase.co'}])assert.throws(()=>validate({...config(),...override}));
 const shared=config();shared.fixtures[1].company_root_id=shared.fixtures[0].company_root_id;assert.throws(()=>validate(shared));
 assert.equal(validate(config()).fixtures.length,2);
});
test('read load probe exercises known own rows and forbidden foreign rows without mutations',async()=>{
 const {runProbe}=await import('../verification/read-load.mjs'),c=config();let requests=0;
 const result=await runProbe(c,async(url,options)=>{requests++;assert.equal(options.method,undefined);assert.equal(options.redirect,'error');const f=c.fixtures.find(x=>'Bearer '+x.access_token===options.headers.Authorization);const requested=url.searchParams.get('restaurant_id').slice(3);const data=requested===f.restaurant_id?[{id:f.probe_reservation_id,restaurant_id:requested}]:[];return new Response(JSON.stringify(data),{status:200});});
 assert.equal(result.pass,true);assert.equal(result.tenant_leaks,0);assert.equal(result.restaurants,2);assert.equal(result.requests,requests);assert(requests>4);
});
test('read load probe fails preflight on cross-company disclosure and empty fake fixtures',async()=>{
 const {runProbe}=await import('../verification/read-load.mjs');
 await assert.rejects(runProbe(config(),async url=>new Response(JSON.stringify([{id:url.searchParams.get('id').slice(3),restaurant_id:url.searchParams.get('restaurant_id').slice(3)}]))),/TENANT_ISOLATION_FAILED/);
 await assert.rejects(runProbe(config(),async()=>new Response('[]')),/OWN_FIXTURE_NOT_VISIBLE/);
});
