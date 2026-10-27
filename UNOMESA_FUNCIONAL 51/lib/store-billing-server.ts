import {assertBranchDowngrade} from "./branch-server";
import {branchCount} from "./branches";
import { NextRequest, NextResponse } from 'next/server';
import { BillingError, acquireBilling, releaseBilling, billingContext, requestBody, serverClients, strictRateLimit } from './billing-server';
import { STORE_CATALOG, selectedStoreProduct, storeReplacementMode, type StoreProvider } from './store-catalog';
import { assertStoreEnabled, assertTestRestaurant, storeEnabled, storeMode, verifyStore, appleVerifier, verifyGooglePush } from './store-verification';
import { readBoundedText } from './server-scale';
import { planFor } from './plans';
const archivedGoogle=(provider:string,row:any)=>provider==='google_play'&&row?.is_ended===true&&Date.parse(row.verified_until)<Date.now()-60*86400000;
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function storeProvider(value:unknown):StoreProvider {if(value!=='apple'&&value!=='google_play')throw new BillingError('Proveedor no válido.');return value;}
export async function storeAccount(admin:any,rid:string) {const a=await admin.from('v2_payment_accounts').select('*').eq('restaurant_id',rid).maybeSingle();if(a.error)throw a.error;return a.data;}
async function verifyStoredPurchase(admin:any,provider:StoreProvider,reference:string) {
 return verifyStore(provider,reference,async(mode,external)=>{
  const purchase=await admin.from('v2_store_purchases').select('restaurant_id').eq('provider','google_play').eq('mode',mode).eq('external_id',external).maybeSingle();
  if(purchase.error)throw purchase.error;if(!purchase.data)return undefined;
  const identity=await admin.from('v2_store_identity').select('account_token').eq('restaurant_id',purchase.data.restaurant_id).maybeSingle();
  if(identity.error)throw identity.error;return identity.data?.account_token;
 });
}
// Shared by authenticated verification and signed notifications. Fetch current
// provider state UNDER the same restaurant lease: delivery order is irrelevant.
export async function reconcileStore(admin:any,rid:string,provider:StoreProvider,reference:string,claim=false) {
 const lease=await acquireBilling(admin,rid);
 try {
  const proof=await verifyStoredPurchase(admin,provider,reference);assertTestRestaurant(proof.mode,rid);
  const id=await admin.from('v2_store_identity').select('account_token').eq('restaurant_id',rid).single();
  const account=await storeAccount(admin,rid);
  if(id.error||id.data.account_token!==proof.accountToken||account?.provider!==provider||account?.mode!==proof.mode)throw new BillingError('Esta compra pertenece a otra cuenta o entorno.',409);
  const old=account.external_subscription_id;
  let replace=false;
  if(old&&old!==proof.external){
   const resubscription=provider==='google_play'?proof.resubscription:undefined;
   if(!claim && proof.linked!==old&&!resubscription)return {verified:false,reason:'superseded'};
   if(resubscription&&(!proof.active||Date.parse(proof.until)<=Date.now()))return {verified:false,reason:'superseded'};
   const previous=await admin.from('v2_store_purchases').select('purchase_reference,product_id,is_ended,verified_until').eq('provider',provider).eq('mode',proof.mode).eq('external_id',old).eq('restaurant_id',rid).single();
   if(previous.error)throw previous.error;
   // Play explicitly identifies this predecessor as expired. Do not query an
   // expiredPurchaseToken: it can be older than Google's API retention window.
   const exactExpired=resubscription?.expired===old;
   if(exactExpired&&previous.data.product_id!==proof.product)throw new Error('GOOGLE_RESUBSCRIPTION_PRODUCT');
   const oldProof=exactExpired||archivedGoogle(provider,previous.data)?undefined:await verifyStoredPurchase(admin,provider,previous.data.purchase_reference);
   const oldEnded=exactExpired||archivedGoogle(provider,previous.data)||oldProof?.ended===true;
   if(resubscription){
    const oldUntil=Date.parse(oldProof?.until||previous.data.verified_until);
    // An earlier/lapsed purchase must never roll back a newer subscription,
    // including an explicit Restore. Account-only context needs chronology.
    if(!oldEnded||(!exactExpired&&(!Number.isFinite(oldUntil)||Date.parse(resubscription.startedAt)<oldUntil)))return {verified:false,reason:'superseded'};
   }
   if(proof.linked!==old && !oldEnded)throw new BillingError('Ya hay una suscripción activa. Gestione esa suscripción antes de contratar otra.',409);
   replace=true;
  }
  const result=await admin.rpc('v2_store_apply',{p_restaurant:rid,p_lease:lease.lease_token,p_provider:provider,p_mode:proof.mode,p_external:proof.external,p_reference:proof.reference,p_product:proof.product,p_plan:proof.plan,p_cycle:proof.cycle,p_active:proof.active,p_until:proof.until,p_cancel:proof.cancel,p_replace:replace,p_ended:proof.ended});
  if(result.error||result.data!==true)throw new Error('STORE_APPLY');
  const capacity=await admin.rpc('v2_branch_apply_capacity',{p_root:rid,p_lease:lease.lease_token,p_provider:provider,p_external:proof.external,p_capacity:proof.branches||1});
  if(capacity.error)throw new Error('BRANCH_ENTITLEMENT_SYNC');
  // Google acknowledgement is retryable after the entitlement is safely saved.
  await proof.acknowledge?.();
  return {verified:true,provider,can_checkout:proof.ended,status:proof.active&&Date.parse(proof.until)>Date.now()?'active':'cancelled',ends_at:proof.until};
 } finally {await releaseBilling(admin,rid,lease.lease_token);}
}
export async function storeAction(req:NextRequest) {
 try {
  const body=await requestBody(req),context=await billingContext(req,body.restaurant_id);
  const {admin,client,user,restaurant}=context;await strictRateLimit(req,'billing:store',30);
  const provider=storeProvider(body.provider),mode=storeMode(provider);assertStoreEnabled(provider);assertTestRestaurant(mode,restaurant.id);
  const exemption=await client.rpc('v2_billing_exempt',{p_restaurant:restaurant.id});if(exemption.error)throw exemption.error;if(exemption.data)throw new BillingError('Esta cuenta está exenta de pago.');
  const account=await storeAccount(admin,restaurant.id);
  if(account && (account.provider!==provider||account.mode!==mode))throw new BillingError('Gestione la suscripción con el proveedor donde la contrató.',409);
  if(body.action==='catalog'){const count=branchCount(body.branches);return json({products:STORE_CATALOG.filter(p=>p.branches===count).map(p=>({...p,productId:p[provider]}))});}
  if(body.action==='prepare') {
   const product=selectedStoreProduct(body.plan,body.cycle,body.branches);
   await assertBranchDowngrade(admin,restaurant.id,product.branches);
   let replacement:string|undefined;let replacementMode="immediate";
   const members=await admin.from('v2_members').select('user_id',{count:'exact',head:true}).eq('restaurant_id',restaurant.id).in('status',['activo','invitado']);
   if(members.error)throw members.error;if((members.count||0)>planFor(product.plan).users)throw new BillingError('El plan no admite todos los usuarios de su equipo.');
   if(account?.external_subscription_id) {
    const saved=await admin.from('v2_store_purchases').select('purchase_reference,is_ended,verified_until').eq('restaurant_id',restaurant.id).eq('provider',provider).eq('mode',mode).eq('external_id',account.external_subscription_id).single();if(saved.error)throw saved.error;
    const checked=archivedGoogle(provider,saved.data)?{can_checkout:true}:await reconcileStore(admin,restaurant.id,provider,saved.data.purchase_reference);
    if(!('can_checkout' in checked)||checked.can_checkout!==true){
     const proof=await verifyStoredPurchase(admin,provider,saved.data.purchase_reference);
     if(!proof.active||Date.parse(proof.until)<=Date.now())throw new BillingError('Resuelva el pago pendiente en la tienda antes de cambiar de paquete.',409);
     replacementMode=storeReplacementMode(provider,proof,product);
     if(replacementMode==='current')throw new BillingError('Este ya es su paquete actual.',409);
     replacement=proof.reference;
    }
   }
   const lease=await acquireBilling(admin,restaurant.id);
   try {const token=await admin.rpc('v2_store_prepare',{p_restaurant:restaurant.id,p_owner:user.id,p_provider:provider,p_mode:mode,p_lease:lease.lease_token});if(token.error)throw token.error;return json({accountToken:token.data,productId:product[provider],basePlan:product.basePlan,replacement,replacementMode});}
   finally{await releaseBilling(admin,restaurant.id,lease.lease_token);}
  }
  if(body.action==='verify') {
   if(typeof body.reference!=='string'||body.reference.length>4096)throw new BillingError('Compra no válida.');
   return json(await reconcileStore(admin,restaurant.id,provider,body.reference,true));
  }
  throw new BillingError('Operación no válida.');
 }catch(e){return json({error:e instanceof BillingError?e.message:'No se pudo verificar la compra. Use Restaurar compras; no vuelva a pagar.',code:e instanceof BillingError?e.code:'STORE_UNAVAILABLE'},e instanceof BillingError?e.status:503);}
}
export async function storeRefresh(req:NextRequest,input:any) {
 const {admin,restaurant,client}=input.context;await strictRateLimit(req,'billing:store-refresh',10);
 const exempt=await client.rpc('v2_billing_exempt',{p_restaurant:restaurant.id});if(exempt.error)throw exempt.error;if(exempt.data)return json({verified:false,reason:'exempt'});
 const account=await storeAccount(admin,restaurant.id),provider=storeProvider(account?.provider);
 if(!account.external_subscription_id)return json({verified:false,reason:'no_subscription'});
 const saved=await admin.from('v2_store_purchases').select('purchase_reference,is_ended,verified_until').eq('restaurant_id',restaurant.id).eq('provider',provider).eq('mode',account.mode).eq('external_id',account.external_subscription_id).single();if(saved.error)throw saved.error;
 if(archivedGoogle(provider,saved.data))return json({verified:false,reason:'archived_expired'});
 return json(await reconcileStore(admin,restaurant.id,provider,saved.data.purchase_reference));
}
export async function storeWebhook(req:NextRequest,provider:StoreProvider) {
 try {
  let reference:string,accountToken:string|undefined;
  if(provider==='apple') {
   const raw=JSON.parse(await readBoundedText(req,128000));const notice=await appleVerifier().verifyAndDecodeNotification(raw.signedPayload);
   if(notice.notificationType==='TEST')return json({received:true});
   if(!notice.data?.signedTransactionInfo)return json({received:true});
   const tx=await appleVerifier().verifyAndDecodeTransaction(notice.data.signedTransactionInfo);reference=tx.originalTransactionId!;accountToken=tx.appAccountToken?.toLowerCase();
  }else{
   await verifyGooglePush(req.headers.get('authorization'));
   const raw=JSON.parse(await readBoundedText(req,128000));const data=JSON.parse(Buffer.from(raw.message?.data||'','base64').toString('utf8'));
   if(data.packageName!=='com.unomesa.android')throw new BillingError('Invalid package',400);
   if(data.testNotification)return json({received:true});
   reference=data.subscriptionNotification?.purchaseToken||data.voidedPurchaseNotification?.purchaseToken;
   if(!reference)return json({received:true});
   const proof=await verifyStoredPurchase(serverClients().admin,provider,reference);accountToken=proof.accountToken;
  }
  if(!accountToken||!reference)throw new BillingError('Missing binding',400);
  const {admin}=serverClients();const identity=await admin.from('v2_store_identity').select('restaurant_id').eq('account_token',accountToken).maybeSingle();if(identity.error)throw identity.error;
  if(!identity.data) return json({received:true,unlinked:true});
  // The lease rechecks current provider state, including out-of-app purchases.
  // Late notifications must not replace a newer entitlement.
  const result=await reconcileStore(admin,identity.data.restaurant_id,provider,reference);
  return json({received:true,...result});
 }catch(e){return json({error:'Notification verification unavailable'},e instanceof BillingError?e.status:503);}
}
export const storeAdapter={refresh:storeRefresh,
 checkout:async()=>json({error:'Use la tienda donde contrató su suscripción.'},409),
 change:async()=>json({error:'Gestione el plan en su tienda.'},409),resume:async()=>json({error:'Reactive el plan en su tienda.'},409),
 portal:async()=>json({error:'Abra Gestionar suscripción en Apple o Google Play.'},409),
 webhook:async()=>json({error:'Use el endpoint de notificaciones de la tienda.'},400),
 validateRedirect:()=>{throw new Error('Native store redirect prohibited');},
 canDelete:async(account:any)=>{
  if(!account.external_subscription_id)return false;
  try {const {admin}=serverClients();const row=await admin.from('v2_store_purchases').select('purchase_reference,is_ended,verified_until').eq('provider',account.provider).eq('mode',account.mode).eq('external_id',account.external_subscription_id).single();if(row.error)return false;
   if(archivedGoogle(account.provider,row.data))return true;
   const proof=await verifyStoredPurchase(admin,storeProvider(account.provider),row.data.purchase_reference);
   return proof.mode===account.mode&&proof.external===account.external_subscription_id&&proof.cancel&&!proof.active&&Date.parse(proof.until)<=Date.now();
  }catch{return false;}
 }
};
