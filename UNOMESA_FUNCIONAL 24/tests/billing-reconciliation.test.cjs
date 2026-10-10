const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const {NextRequest}=require('next/server');
const rid='22222222-2222-4222-8222-222222222222',uid='11111111-1111-4111-8111-111111111111',aid='33333333-3333-4333-8333-333333333333';
function setup(){
 const now=Date.now(),past=new Date(now-86400000).toISOString(),future=new Date(now+86400000*25).toISOString();
 const user={id:uid,email:'owner@example.test',email_confirmed_at:past};
 const restaurant={id:rid,owner_id:uid,name:'Fixture',access_status:'active',subscription_status:'cancelled',plan_code:'intermediate',lemon_subscription_id:'20',lemon_customer_id:'30',stripe_subscription_id:null,billing_current_period_end:past,billing_cancel_at_period_end:true};
 const account={restaurant_id:rid,provider:'lemon_squeezy',mode:'live',owner_id:uid,external_subscription_id:'20',external_customer_id:'30'};
 const binding={id:aid,restaurant_id:rid,owner_id:uid,owner_email:user.email,store_id:'10',customer_id:'30',subscription_id:'20',order_id:'40',variant_id:'50',plan_code:'intermediate',billing_cycle:'month',created_at:past,expires_at:past};
 const db={v2_restaurants:[restaurant],v2_payment_accounts:[account],v2_lemon_checkouts:[binding],v2_members:[{restaurant_id:rid,user_id:uid,role:'admin',status:'activo'}],v2_billing_state:[{restaurant_id:rid,lease_token:'lease',pending_plan_change:null}],v2_billing_events:[]};
 const resource=(type,id,attributes)=>({type,id,attributes:{test_mode:false,updated_at:past,...attributes}});
 const sub=resource('subscriptions','20',{store_id:10,customer_id:30,order_id:40,user_email:user.email,variant_id:50,status:'expired',cancelled:true,ends_at:past,renews_at:null,created_at:past,first_subscription_item:{price_id:60,quantity:1},urls:{customer_portal:'https://pay.unomesa.com/billing'}});
 const invoice=resource('subscription-invoices','70',{store_id:10,customer_id:30,subscription_id:20,currency:'USD',status:'paid',refunded:false,billing_reason:'initial'});
 const order=resource('orders','40',{store_id:10,customer_id:30,status:'paid'});
 const price=resource('prices','60',{variant_id:50,unit_price:4500,category:'subscription',scheme:'standard',renewal_interval_unit:'month',renewal_interval_quantity:1,setup_fee_enabled:false,usage_aggregation:null,package_size:1});
 const state={exempt:false,mfa:true,authenticated:true,allowRate:true,providerFails:false,applyFails:false,ignoreApply:false,locked:false,fetches:[],writes:[],applied:[],past,future,restaurant,account,binding,sub,invoice,order,price,db};
 function from(table){let filters=[],mode='read',values=null,one=false,count=false,limit=Infinity,sort=null;
  const q={select(cols,opts){count=opts?.count==='exact';return q},eq(k,v){filters.push(x=>x[k]===v);return q},in(k,vs){filters.push(x=>vs.includes(x[k]));return q},gt(k,v){filters.push(x=>x[k]>v);return q},order(k,opts){sort={k,ascending:opts?.ascending};return q},limit(n){limit=n;return q},insert(v){mode='insert';values=v;return q},update(v){mode='update';values=v;return q},single(){one=true;return run()},maybeSingle(){one=true;return run()},then(resolve,reject){return run().then(resolve,reject)}};
  async function run(){let rows=(db[table]||[]).filter(x=>filters.every(f=>f(x)));if(sort)rows.sort((a,b)=>(a[sort.k]>b[sort.k]?1:-1)*(sort.ascending?1:-1));rows=rows.slice(0,limit);
   if(mode==='insert'){state.writes.push({table,mode,values});db[table].push({...values});rows=[values]}
   if(mode==='update'){state.writes.push({table,mode,values});rows.forEach(x=>Object.assign(x,values))}
   return {data:one?(rows[0]?{...rows[0]}:null):rows.map(x=>({...x})),error:null,...(count?{count:rows.length}:{})};
  }return q;
 }
 const client={from,auth:{getUser:async()=>({data:{user:state.authenticated?user:null},error:null})},rpc:async(name,args)=>{
  if(name==='v2_billing_exempt')return {data:state.exempt};
  if(name==='v2_take_rate_limit')return {data:state.allowRate};
  if(name==='v2_billing_acquire'){if(state.locked)return {data:null};state.locked=true;return {data:{lease_token:'lease',pending_plan_change:null}}}
  if(name==='v2_pin_billing_provider')return {data:null};
  if(name==='v2_lemon_apply'){
   state.applied.push(args);if(state.applyFails)return {error:{code:'XX001'}};
   assert.equal(args.p_attempt,aid);assert.equal(args.p_lease,'lease');assert.equal(args.p_subscription,'20');assert.match(args.p_event,/^lemon_live_[a-f0-9]{64}$/);
   if(!state.ignoreApply){restaurant.subscription_status=args.p_status;restaurant.billing_cancel_at_period_end=args.p_cancel_at_end;if(args.p_paid_until)restaurant.billing_current_period_end=args.p_paid_until;}
   return {data:true};
  }throw new Error('Unexpected RPC '+name);
 }};
 // Releasing the database lease is observable in the table update.
 const baseFrom=client.from;client.from=table=>{const q=baseFrom(table),update=q.update;q.update=v=>{if(table==='v2_billing_state'&&v.lease_token===null)state.locked=false;return update(v)};return q};
 const env={NEXT_PUBLIC_SUPABASE_URL:'https://fixture.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',NEXT_PUBLIC_SITE_URL:'https://www.unomesa.com',LEMON_SQUEEZY_MODE:'live',LEMON_SQUEEZY_STORE_ID:'10',LEMON_SQUEEZY_API_KEY:'fixture-key',LEMON_SQUEEZY_WEBHOOK_SECRET:'fixture-secret',LEMON_SQUEEZY_VARIANT_INTERMEDIATE_MONTHLY:'50'};
 async function fetch(url,opts){state.fetches.push({url,method:opts.method});assert(url.startsWith('https://api.lemonsqueezy.com/v1/'));if(state.providerFails)return new Response('{}',{status:503});let data;const u=new URL(url),p=u.pathname.replace('/v1','');
  if(p==='/subscriptions/20')data=sub;
  else if(p==='/subscription-invoices'){assert.equal(u.searchParams.get('filter[subscription_id]'),'20');data=[invoice]}
  else if(p==='/prices/60')data=price;
  else if(p==='/orders/40')data=order;
  else if(p==='/variants/50')data=resource('variants','50',{product_id:80,status:'published'});
  else if(p==='/products/80')data=resource('products','80',{store_id:10});
  else if(p==='/prices')data=[price];
  else if(p==='/checkouts'){assert.equal(opts.method,'POST');const body=JSON.parse(opts.body);assert.equal(body.data.attributes.checkout_options.skip_trial,true);data=resource('checkouts','90',{store_id:10,variant_id:50,preview:{currency:'USD',subtotal:4500,discount_total:0},url:'https://pay.unomesa.com/checkout/custom/fixture'})}
  else throw new Error('Unexpected provider request '+p);
  return Response.json({data});
 }
 const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;
  const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const req=name=>{
   if(name==='@supabase/supabase-js')return {createClient:()=>client};
   if(name==='@/lib/mfa')return {requireVerifiedMfa:async()=>{if(!state.mfa)throw new Error('MFA required')}};
   if(name==='./server-scale'||name==='@/lib/server-scale')return {RequestSafetyError:class extends Error{},readBoundedJson:request=>request.json(),readBoundedText:request=>request.text()};
   if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
   if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
   return require(name);
  };
  vm.runInNewContext(src,{exports:m.exports,module:m,require:req,process:{env},fetch,console:{error:()=>{},warn:()=>{}},Buffer,URL,URLSearchParams,Date,AbortSignal,setTimeout,clearTimeout,Response,Request});return m.exports;
 }
 const provider=load('lib/billing-provider.ts');
 state.dispatch=async(action='refresh',body={},headers={})=>{const req=new NextRequest('https://www.unomesa.com/api/billing/'+action,{method:'POST',headers:{authorization:'Bearer fixture-token',origin:'https://www.unomesa.com','content-type':'application/json',...headers},body:JSON.stringify({restaurant_id:rid,language:'es',plan:'intermediate',interval:'month',...body})});const response=await provider.dispatchBilling(action,req);return {status:response.status,body:await response.json(),cache:response.headers.get('cache-control')}};
 state.webhook=async(valid=true)=>{const raw=JSON.stringify({meta:{event_name:'subscription_updated'},data:sub}),signature=crypto.createHmac('sha256','fixture-secret').update(raw).digest('hex');return provider.dispatchBillingWebhook(new NextRequest('https://www.unomesa.com/api/billing/webhook',{method:'POST',headers:{'x-signature':valid?signature:'0'.repeat(64)},body:raw}))};
 return state;
}
test('owner refresh reads provider proof and synchronizes an ended subscription before showing success',async()=>{
 const x=setup();x.restaurant.subscription_status='active';const r=await x.dispatch();assert.equal(r.status,200);assert.equal(r.body.verified,true);assert.equal(r.body.can_checkout,true);assert.equal(x.restaurant.subscription_status,'cancelled');assert.equal(r.cache,'no-store');assert.equal(x.applied.length,1);assert(x.fetches.every(x=>x.method==='GET'));assert.equal(x.locked,false);
 const receipt=x.applied[0].p_event;x.sub.attributes.urls.customer_portal+='?signature=rotated';await x.dispatch();assert.equal(x.applied[1].p_event,receipt,'signed portal URL rotation must not create a new reconciliation receipt');
});
test('cancelled subscription at or past its provider end date can use Pay now without a duplicate trial',async()=>{
 for(const status of ['expired','cancelled']){const x=setup();x.sub.attributes.status=status;const r=await x.dispatch('checkout');assert.equal(r.status,200,JSON.stringify(r.body));assert.match(r.body.url,/checkout/);assert.equal(x.fetches.filter(x=>x.method==='POST').length,1);assert.equal(x.restaurant.subscription_status,'cancelled','checkout itself does not activate access');assert.equal(x.locked,false);}
});
test('live subscriptions, future cancellations, unpaid, paused and unknown states cannot create duplicate subscriptions',async()=>{
 for(const status of ['active','on_trial','past_due','unpaid','paused','unknown','cancelled']){const x=setup();x.sub.attributes.status=status;x.sub.attributes.ends_at=x.future;const r=await x.dispatch('checkout');assert.equal(r.status,409,status);assert(!x.fetches.some(x=>x.method==='POST'));assert(!x.writes.some(x=>x.table==='v2_lemon_checkouts'));}
 const x=setup();x.sub.attributes.status='cancelled';x.sub.attributes.ends_at='invalid';assert.equal((await x.dispatch('checkout')).status,409);
});
test('stale UnoMesa state requires verified refresh then enables new checkout',async()=>{
 const x=setup();x.restaurant.subscription_status='active';assert.equal((await x.dispatch('checkout')).body.code,'SUBSCRIPTION_SYNC_REQUIRED');assert.equal((await x.dispatch()).body.verified,true);assert.equal((await x.dispatch('checkout')).status,200);
});
test('paid active invoices grant only verified future access; fully refunded payments never do',async()=>{
 const x=setup();Object.assign(x.sub.attributes,{status:'active',cancelled:false,ends_at:null,renews_at:x.future});assert.equal((await x.dispatch()).body.status,'active');assert.equal(x.restaurant.billing_current_period_end,x.future);
 for(const where of ['invoice','order']){const x=setup();Object.assign(x.sub.attributes,{status:'active',cancelled:false,ends_at:null,renews_at:x.future});x[where].attributes.status='refunded';const r=await x.dispatch();assert.equal(r.body.refunded,true);assert.equal(r.body.status,'cancelled');assert.equal(r.body.can_checkout,false);assert.equal(x.applied[0].p_paid_until,null);}
});
test('owner, tenant, MFA and request-origin gates reject before provider calls',async()=>{
 for(const alter of [x=>x.db.v2_members[0].role='gerente',x=>x.restaurant.owner_id='another-owner',x=>x.mfa=false,x=>x.authenticated=false]){const x=setup();alter(x);assert((await x.dispatch()).status>=400);assert.equal(x.fetches.length,0)}
 const x=setup();assert.equal((await x.dispatch('refresh',{}, {origin:'https://other.test'})).status,403);assert.equal(x.fetches.length,0);
 const y=setup();assert((await y.dispatch('refresh',{restaurant_id:'44444444-4444-4444-8444-444444444444'})).status>=400);assert.equal(y.fetches.length,0);
});
test('exempt accounts remain untouched and no-subscription accounts never claim provider verification',async()=>{
 const x=setup();x.exempt=true;const before=JSON.stringify(x.restaurant);assert.equal((await x.dispatch()).body.reason,'exempt');assert.equal(JSON.stringify(x.restaurant),before);assert.equal(x.fetches.length,0);assert.equal(x.applied.length,0);
 const y=setup();y.account.external_subscription_id=null;y.restaurant.lemon_subscription_id=null;const r=await y.dispatch();assert.equal(r.body.verified,false);assert.equal(r.body.reason,'no_subscription');assert.equal(y.fetches.length,0);
});
test('wrong provider bindings, invoice identity, mode, price and failed writes never claim success',async()=>{
 for(const alter of [x=>x.account.external_customer_id='999',x=>x.account.mode='test',x=>x.sub.id='999',x=>x.sub.attributes.customer_id=999,x=>x.sub.attributes.user_email='other@example.test',x=>x.invoice.attributes.subscription_id=999,x=>x.invoice.attributes.currency='MXN',x=>x.sub.attributes.test_mode=true,x=>x.price.attributes.unit_price=1,x=>x.providerFails=true,x=>x.applyFails=true]){const x=setup();alter(x);const r=await x.dispatch();assert(r.status>=400);assert.notEqual(r.body.verified,true);assert.equal(x.locked,false);}
 const x=setup();x.restaurant.subscription_status='active';x.ignoreApply=true;const r=await x.dispatch();assert.equal(r.status,409);assert.notEqual(r.body.verified,true);
});
test('webhooks keep signature validation and use the same proof checks as owner refresh',async()=>{
 const x=setup();assert.equal((await x.webhook(false)).status,400);assert.equal(x.fetches.length,0);assert.equal(x.applied.length,0);
 assert.equal((await x.webhook()).status,200);assert.equal(x.applied.length,1);assert(x.fetches.every(x=>x.method==='GET'));
 const y=setup();y.invoice.attributes.customer_id=999;assert.equal((await y.webhook()).status,503);assert.equal(y.applied.length,0);
});

test('browser payment claims cannot change the verified provider result',async()=>{
 const x=setup();const r=await x.dispatch('refresh',{status:'active',paid:true,verified:true,provider_status:'active',subscription_id:'999'});assert.equal(r.body.status,'cancelled');assert.equal(x.restaurant.subscription_status,'cancelled');assert(x.fetches.every(x=>x.method==='GET'));
});
