const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const ts=require('typescript');
const hash=value=>createHash('sha256').update(value).digest('hex');
const date=days=>new Date(Date.now()+days*86400000).toISOString();
const copy=value=>structuredClone(value);
const RID='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const ID='33333333-3333-4333-8333-333333333333';
const OTHER_ID='44444444-4444-4444-8444-444444444444';

// Exercise the real verifier, catalog, webhook and reconciliation together.
// Only the Google HTTP transport, billing lease and database are simulated.
function fixture({product='unomesa_advanced',basePlan='monthly',expiredId=true,expiredToken=true}={}){
 const account={restaurant_id:RID,provider:'google_play',mode:'live',external_subscription_id:hash('old')};
 const identities=[{restaurant_id:RID,account_token:ID},{restaurant_id:OTHER,account_token:OTHER_ID}];
 const purchases=[{provider:'google_play',mode:'live',external_id:hash('old'),restaurant_id:RID,purchase_reference:'old',product_id:product,is_ended:true,verified_until:date(-100)}];
 const restaurant={id:RID,trial_ends_at:'2025-01-01',subscription_status:'cancelled',settings:{logo:'saved-logo'},reservations:[{id:'real-reservation'}],quotes:[{id:'real-quote'}],customers:[{id:'real-customer'}]};
 const context={...(expiredId?{expiredExternalAccountIdentifiers:{obfuscatedExternalAccountId:ID}}:{}),...(expiredToken?{expiredPurchaseToken:'old'}:{})};
 const fresh={subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',startTime:date(-0.01),acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',outOfAppPurchaseContext:context,lineItems:[{productId:product,expiryTime:date(30),autoRenewingPlan:{autoRenewEnabled:true},offerDetails:{basePlanId:basePlan}}]};
 const api=new Map([['new',fresh]]);
 const state={account,identities,purchases,restaurant,api,calls:[],queries:[],events:[],locked:false,acks:0,applies:0,capacity:1,failApply:false,failCapacity:false,failAck:false,ackTimeout:false,omitAckIdentity:false,failQuery:false,badPush:false};
 const env={GOOGLE_PLAY_BILLING_MODE:'live',GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:'{}',GOOGLE_PLAY_PUSH_AUDIENCE:'test-audience',GOOGLE_PLAY_PUSH_SERVICE_ACCOUNT:'push@example.invalid',STORE_TEST_RESTAURANT_IDS:RID};
 const admin={from(table){const filters=[];let columns;
  const query={select(value){columns=value;return query},eq(key,value){filters.push([key,value]);return query},single(){return run(true)},maybeSingle(){return run(false)}};
  async function run(required){
   state.queries.push({table,columns,filters:copy(filters)});
   if(state.failQuery)return {error:new Error('database unavailable'),data:null};
   const rows=table==='v2_store_purchases'?purchases:table==='v2_store_identity'?identities:table==='v2_payment_accounts'?[account]:[];
   const found=rows.find(row=>filters.every(([key,value])=>row[key]===value));
   return {data:found?copy(found):null,error:required&&!found?new Error('missing row'):null};
  }
  return query;
 },async rpc(name,args){
  assert.equal(state.locked,true,'writes must hold the restaurant lease');
  if(name==='v2_branch_apply_capacity'){
   if(state.failCapacity)return {error:new Error('capacity unavailable')};
   assert.equal(args.p_root,RID);assert.equal(args.p_external,account.external_subscription_id);
   state.events.push('capacity');state.capacity=args.p_capacity;return {data:true,error:null};
  }
  assert.equal(name,'v2_store_apply');
  if(state.failApply)return {data:false,error:new Error('apply unavailable')};
  assert.equal(args.p_restaurant,RID);assert.equal(args.p_provider,account.provider);assert.equal(args.p_mode,account.mode);
  let row=purchases.find(row=>row.external_id===args.p_external&&row.mode===args.p_mode&&row.provider===args.p_provider);
  if(row&&row.restaurant_id!==args.p_restaurant)return {error:new Error('already claimed')};
  if(account.external_subscription_id!==args.p_external&&!args.p_replace)return {data:false,error:null};
  if(!row){row={provider:args.p_provider,mode:args.p_mode,external_id:args.p_external,restaurant_id:args.p_restaurant,purchase_reference:args.p_reference};purchases.push(row);}
  Object.assign(row,{product_id:args.p_product,is_ended:args.p_ended,verified_until:args.p_until});
  account.external_subscription_id=args.p_external;
  Object.assign(restaurant,{plan_code:args.p_plan,billing_cycle:args.p_cycle,subscription_status:args.p_active&&Date.parse(args.p_until)>Date.now()?'active':'cancelled'});
  state.events.push('apply');state.applies++;return {data:true,error:null};
 }};
 class BillingError extends Error{constructor(message,status=400,code){super(message);this.status=status;this.code=code;}}
 const cache={};
 function load(file){
  file=path.resolve(file);if(cache[file])return cache[file].exports;
  const module={exports:{}};cache[file]=module;
  const requireMock=name=>{
   if(name==='./billing-server')return {BillingError,serverClients:()=>({admin}),acquireBilling:async()=>{assert.equal(state.locked,false);state.locked=true;return {lease_token:'lease'}},releaseBilling:async()=>{state.locked=false}};
   if(name==='./branch-server')return {};
   if(name==='./server-scale')return {readBoundedText:async(req,max)=>{const text=await req.text();assert(text.length<=max);return text}};
   if(name==='next/server')return {NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),options)}};
   if(name==='google-auth-library')return {
    GoogleAuth:class{async getClient(){return {request:async request=>{
     const reference=decodeURIComponent(request.url.match(/\/tokens\/([^/]+?)(?::acknowledge)?$/)[1]);
     state.calls.push({reference,method:request.method,body:copy(request.data)});
     const data=api.get(reference);if(!data)throw new Error('Google token is no longer queryable');
     if(request.method==='POST'){
      assert.equal(state.locked,true,'acknowledge must hold the lease');
      assert.equal(account.external_subscription_id,hash(reference));
      assert.equal(state.events.at(-1),'capacity','save access and capacity before acknowledgement');
      if(state.failAck)throw new Error('acknowledge network failure');
      state.events.push('acknowledge');state.acks++;
      data.acknowledgementState='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
      if(!state.omitAckIdentity&&request.data?.externalAccountIds)data.externalAccountIdentifiers={obfuscatedExternalAccountId:request.data.externalAccountIds.obfuscatedAccountId};
      delete data.outOfAppPurchaseContext;
      if(state.ackTimeout){state.ackTimeout=false;throw new Error('ack succeeded but response timed out');}
      return {data:{}};
     }
     return {data:copy(data)};
    }}}},
    OAuth2Client:class{async verifyIdToken(){if(state.badPush)throw new Error('invalid push signature');return {getPayload:()=>({email_verified:true,email:env.GOOGLE_PLAY_PUSH_SERVICE_ACCOUNT,iss:'https://accounts.google.com'})}}}};
   if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
   return require(name);
  };
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:requireMock,process:{env,cwd:process.cwd},Date,Buffer,console,Response});
  return module.exports;
 }
 const server=load('lib/store-billing-server.ts');
 return {state,env,fresh,run:(reference='new',rid=RID,claim=false)=>server.reconcileStore(admin,rid,'google_play',reference,claim),
  async webhook(reference='new',authorization='Bearer signed-token'){
   const data=Buffer.from(JSON.stringify({packageName:'com.unomesa.android',subscriptionNotification:{purchaseToken:reference}})).toString('base64');
   return server.storeWebhook(new Request('https://example.invalid/webhook',{method:'POST',headers:{authorization},body:JSON.stringify({message:{data}})}),'google_play');
  }};
}

for(const [name,options] of [['expired account ID and token',{}],['expired account ID only',{expiredToken:false}],['expired token only',{expiredId:false}]]){
 test('Play resubscription restores the same restaurant using '+name,async()=>{
  const x=fixture(options),saved=copy(x.state.restaurant);
  const response=await x.webhook();assert.equal(response.status,200);assert.equal((await response.json()).verified,true);
  assert.equal(x.state.account.external_subscription_id,hash('new'));assert.equal(x.state.restaurant.subscription_status,'active');assert.equal(x.state.acks,1);
  for(const field of ['id','trial_ends_at','settings','reservations','quotes','customers'])assert.deepEqual(x.state.restaurant[field],saved[field]);
  assert.equal(x.state.calls.some(call=>call.reference==='old'),false,'old tokens beyond 60 days must not be queried');
  assert.equal(x.state.calls.find(call=>call.method==='POST').body.externalAccountIds.obfuscatedAccountId,ID);
  assert.equal(x.state.locked,false);
 });
}

for(const [product,basePlan,plan,cycle,capacity] of [
 ['unomesa_basic','anual','basic','year',1],['unomesa_intermediate','anual','intermediate','year',1],['unomesa_advanced','anual','advanced','year',1],
 ['unomesa_basic','monthly','basic','month',1],['unomesa_basic','annual','basic','year',1],
 ['unomesa_intermediate','monthly','intermediate','month',1],['unomesa_intermediate','annual','intermediate','year',1],
 ['unomesa_advanced','monthly','advanced','month',1],['unomesa_advanced','annual','advanced','year',1],
 ['multiple_locations','2-branches','advanced','month',2],['multiple_locations','3-branches','advanced','month',3],
 ['multiple_locations','4-branches','advanced','month',4],['multiple_locations','5-branches','advanced','month',5],
 ['unomesa_branches_2','monthly','advanced','month',2],['unomesa_branches_5','monthly','advanced','month',5],['unomesa_branches_85','monthly','advanced','month',85]]){
 test(`resubscription restores catalog entitlement ${product}/${basePlan}`,async()=>{
  const x=fixture({product,basePlan});await x.run();assert.equal(x.state.restaurant.plan_code,plan);assert.equal(x.state.restaurant.billing_cycle,cycle);assert.equal(x.state.capacity,capacity);
 });
}

test('verified expired predecessor recovers even when its expiration notification was lost',async()=>{
 const x=fixture({expiredId:false});x.state.purchases[0].is_ended=false;
 assert.equal((await x.run()).verified,true);assert.equal(x.state.acks,1);
 assert.equal(x.state.calls.some(call=>call.reference==='old'),false);
});

test('duplicate webhooks, Restore and renewals keep the same binding after context disappears',async()=>{
 const x=fixture();await x.run();await x.run('new',RID,true);await x.webhook();
 assert.equal(x.state.acks,1);assert.equal(x.state.purchases.length,2);
 x.fresh.lineItems[0].expiryTime=date(60);await x.run();
 assert.equal(x.state.purchases.find(row=>row.external_id===hash('new')).verified_until,x.fresh.lineItems[0].expiryTime);
 assert.equal(x.state.account.external_subscription_id,hash('new'));
});

test('durable saved binding survives an acknowledgement response timeout and missing API account ID',async()=>{
 const x=fixture();x.state.ackTimeout=true;x.state.omitAckIdentity=true;
 await assert.rejects(x.run(),/timed out/);assert.equal(x.state.acks,1);assert.equal(x.state.locked,false);
 assert.equal((await x.run()).verified,true);assert.equal(x.state.acks,1);
 const response=await x.webhook();assert.equal(response.status,200);assert.equal((await response.json()).verified,true);
 assert(x.state.queries.some(q=>q.table==='v2_store_purchases'&&q.filters.some(([key,value])=>key==='external_id'&&value===hash('new'))));
});

for(const failure of ['failApply','failCapacity','failAck']){
 test(`a retry recovers ${failure} without a second purchase or trial`,async()=>{
  const x=fixture();x.state[failure]=true;await assert.rejects(x.run());assert.equal(x.state.acks,0);assert.equal(x.state.locked,false);
  x.state[failure]=false;assert.equal((await x.run()).verified,true);assert.equal(x.state.acks,1);assert.equal(x.state.purchases.length,2);assert.equal(x.state.restaurant.trial_ends_at,'2025-01-01');
 });
}

test('grace, account hold, recovery and expiration still update one subscription',async()=>{
 const x=fixture();await x.run();
 for(const [status,expected] of [['IN_GRACE_PERIOD','active'],['ON_HOLD','cancelled'],['ACTIVE','active'],['EXPIRED','cancelled']]){
  x.fresh.subscriptionState='SUBSCRIPTION_STATE_'+status;
  x.fresh.lineItems[0].expiryTime=date(expected==='active'?30:-1);
  await x.run();assert.equal(x.state.restaurant.subscription_status,expected);assert.equal(x.state.account.external_subscription_id,hash('new'));
 }
 assert.equal(x.state.acks,1);assert.equal(x.state.purchases.length,2);
});

test('late predecessor notifications cannot overwrite the recovered entitlement',async()=>{
 const x=fixture();await x.run();
 x.state.api.set('old',{subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',externalAccountIdentifiers:{obfuscatedExternalAccountId:ID},acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',lineItems:[{productId:'unomesa_advanced',expiryTime:date(-100),offerDetails:{basePlanId:'monthly'}}]});
 assert.equal((await x.run('old')).reason,'superseded');assert.equal(x.state.account.external_subscription_id,hash('new'));assert.equal(x.state.restaurant.subscription_status,'active');assert.equal(x.state.acks,1);
});

test('late resubscription and explicit Restore cannot replace a newer active purchase',async()=>{
 const x=fixture();const current=copy(x.fresh);delete current.outOfAppPurchaseContext;
 Object.assign(current,{externalAccountIdentifiers:{obfuscatedExternalAccountId:ID},acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'});
 x.state.api.set('current',current);x.state.account.external_subscription_id=hash('current');
 x.state.purchases.push({...copy(x.state.purchases[0]),external_id:hash('current'),purchase_reference:'current',is_ended:false,verified_until:date(30)});
 for(const claim of [false,true])assert.equal((await x.run('new',RID,claim)).reason,'superseded');
 assert.equal(x.state.applies,0);assert.equal(x.state.acks,0);assert.equal(x.state.account.external_subscription_id,hash('current'));
});

test('resubscribing to a former SKU works only after the latest subscription ended',async()=>{
 const x=fixture({product:'unomesa_basic'});
 x.state.account.external_subscription_id=hash('later');
 x.state.purchases.push({...copy(x.state.purchases[0]),external_id:hash('later'),purchase_reference:'later',product_id:'unomesa_advanced',verified_until:date(-1)});
 x.state.api.set('later',{subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',externalAccountIdentifiers:{obfuscatedExternalAccountId:ID},acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',lineItems:[{productId:'unomesa_advanced',expiryTime:date(-1),offerDetails:{basePlanId:'monthly'}}]});
 assert.equal((await x.run()).verified,true);assert.equal(x.state.restaurant.plan_code,'basic');
});

test('account-only context cannot roll back a purchase that ended after this resubscription started',async()=>{
 const x=fixture({expiredToken:false});x.fresh.startTime=date(-110);
 assert.equal((await x.run()).reason,'superseded');assert.equal(x.state.applies,0);assert.equal(x.state.acks,0);
});

test('expired or pending repurchases grant no access and receive no acknowledgement',async()=>{
 for(const status of ['EXPIRED','PENDING','PENDING_PURCHASE_CANCELED']){
  const x=fixture();x.fresh.subscriptionState='SUBSCRIPTION_STATE_'+status;x.fresh.lineItems[0].expiryTime=date(-1);
  if(status==='EXPIRED')assert.equal((await x.run()).reason,'superseded');else await assert.rejects(x.run(),/pendiente/);
  assert.equal(x.state.applies,0);assert.equal(x.state.acks,0);
 }
});

test('unknown identity, another restaurant, conflicting IDs and mode/provider mismatches fail closed',async()=>{
 for(const change of [
  x=>x.fresh.outOfAppPurchaseContext.expiredExternalAccountIdentifiers.obfuscatedExternalAccountId=OTHER_ID,
  x=>x.fresh.externalAccountIdentifiers={obfuscatedExternalAccountId:OTHER_ID},
  x=>x.state.account.provider='lemon_squeezy',x=>x.state.account.mode='test',
  x=>x.fresh.testPurchase={},x=>x.fresh.lineItems[0].productId='unknown',
  x=>x.state.purchases[0].product_id='unomesa_basic',
  x=>x.fresh.outOfAppPurchaseContext={expiredPurchaseToken:'unknown'},
  x=>x.fresh.outOfAppPurchaseContext={},x=>x.state.failQuery=true,
  x=>x.fresh.outOfAppPurchaseContext.expiredPurchaseToken='new',
  x=>x.fresh.startTime='invalid',x=>x.fresh.linkedPurchaseToken='old'
 ]){
  const x=fixture();change(x);await assert.rejects(x.run());assert.equal(x.state.applies,0);assert.equal(x.state.acks,0);assert.equal(x.state.locked,false);
 }
 const x=fixture();await assert.rejects(x.run('new',OTHER,true));assert.equal(x.state.applies,0);assert.equal(x.state.acks,0);
});

test('expired token fallback is scoped to google_play and the verified environment',async()=>{
 for(const change of [x=>x.state.purchases[0].provider='apple',x=>x.state.purchases[0].mode='test']){
  const x=fixture({expiredId:false});change(x);await assert.rejects(x.run());assert.equal(x.state.applies,0);assert.equal(x.state.acks,0);
 }
});

test('test purchases only restore an explicitly allowed test restaurant',async()=>{
 const x=fixture();x.env.GOOGLE_PLAY_BILLING_MODE='test';x.state.account.mode='test';x.state.purchases[0].mode='test';x.fresh.testPurchase={};
 x.env.STORE_TEST_RESTAURANT_IDS=OTHER;await assert.rejects(x.run());assert.equal(x.state.applies,0);
 x.env.STORE_TEST_RESTAURANT_IDS=RID;assert.equal((await x.run()).verified,true);
});

test('forged push authentication is rejected before any purchase read or mutation',async()=>{
 const x=fixture();x.state.badPush=true;const response=await x.webhook();assert.equal(response.status,503);assert.equal(x.state.calls.length,0);assert.equal(x.state.applies,0);assert.equal(x.state.acks,0);
});
