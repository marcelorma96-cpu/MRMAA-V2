import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AppStoreServerAPIClient, Environment, SignedDataVerifier, Status } from '@apple/app-store-server-library';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { BillingError } from './billing-server';
import { storeProduct, type StoreProof, type StoreProvider } from './store-catalog';
export function setting(name:string) { const value=process.env[name];if(!value)throw new BillingError('Compras de la tienda aún no configuradas.',503,'STORE_NOT_CONFIGURED');return value; }
export function storeMode(provider:StoreProvider):'test'|'live' { const v=setting(provider==='apple'?'APPLE_BILLING_MODE':'GOOGLE_PLAY_BILLING_MODE');if(v!=='test'&&v!=='live')throw new Error('STORE_MODE');return v; }
export function storeEnabled(provider:StoreProvider) {return process.env[provider==='apple'?'APPLE_BILLING_ENABLED':'GOOGLE_PLAY_BILLING_ENABLED']==='true';}
export function assertStoreEnabled(provider:StoreProvider) {if(!storeEnabled(provider))throw new BillingError('Las compras en esta tienda todavía no están disponibles.',503,'STORE_DISABLED');}
export function assertTestRestaurant(mode:string,rid:string) {if(mode==='test' && !setting('STORE_TEST_RESTAURANT_IDS').split(',').map(v=>v.trim()).includes(rid))throw new BillingError('Las compras de prueba requieren un restaurante de pruebas autorizado.',403);}
export function appleVerifier(mode=storeMode('apple')) {
 const roots=['AppleRootCA-G3.cer','AppleRootCA-G2.cer'].map(f=>readFileSync(join(process.cwd(),'certificates',f)));
 return new SignedDataVerifier(roots,true,mode==='test'?Environment.SANDBOX:Environment.PRODUCTION,'com.unomesa.app',mode==='live'?Number(setting('APPLE_APP_ID')):undefined);
}
export async function verifyApple(reference:string):Promise<StoreProof> {
 if(!/^\d{1,40}$/.test(reference)) throw new Error('APPLE_REFERENCE');
 const mode=storeMode('apple'), verifier=appleVerifier(mode);
 const api=new AppStoreServerAPIClient(setting('APPLE_PRIVATE_KEY').replace(/\\n/g,'\n'),setting('APPLE_KEY_ID'),setting('APPLE_ISSUER_ID'),'com.unomesa.app',mode==='test'?Environment.SANDBOX:Environment.PRODUCTION);
 const initial=await api.getTransactionInfo(reference);
 const original=await verifier.verifyAndDecodeTransaction(initial.signedTransactionInfo!);
 if(!original.originalTransactionId)throw new Error('APPLE_ORIGINAL');
 const states=await api.getAllSubscriptionStatuses(original.originalTransactionId);
 const item=states.data?.flatMap(g=>g.lastTransactions||[]).find(t=>t.originalTransactionId===original.originalTransactionId);
 if(!item?.signedTransactionInfo||!item.signedRenewalInfo)throw new Error('APPLE_STATE');
 const tx=await verifier.verifyAndDecodeTransaction(item.signedTransactionInfo), renewal=await verifier.verifyAndDecodeRenewalInfo(item.signedRenewalInfo);
 if(tx.originalTransactionId!==original.originalTransactionId||renewal.originalTransactionId!==tx.originalTransactionId||!tx.appAccountToken||tx.inAppOwnershipType!=='PURCHASED'||tx.type!=='Auto-Renewable Subscription')throw new Error('APPLE_BINDING');
 const product=storeProduct('apple',tx.productId!);
 const until=item.status===Status.BILLING_GRACE_PERIOD ? renewal.gracePeriodExpiresDate : tx.expiresDate;
 if(!until||!Number.isFinite(until))throw new Error('APPLE_EXPIRY');
 return {provider:'apple',mode,external:tx.originalTransactionId!,reference:tx.originalTransactionId!,accountToken:tx.appAccountToken.toLowerCase(),product:tx.productId!,plan:product.plan,cycle:product.cycle,branches:product.branches,
 active:!tx.revocationDate && [Status.ACTIVE,Status.BILLING_GRACE_PERIOD].includes(item.status!),ended:item.status===Status.EXPIRED||(item.status===Status.REVOKED&&renewal.autoRenewStatus!==1),until:new Date(until).toISOString(),cancel:renewal.autoRenewStatus!==1};
}
let googleAuth:GoogleAuth|undefined;
function google() { return googleAuth??=new GoogleAuth({credentials:JSON.parse(setting('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')),scopes:['https://www.googleapis.com/auth/androidpublisher']}); }
export const tokenHash=(value:string)=>createHash('sha256').update(value).digest('hex');
async function googleRequest(path:string,method:'GET'|'POST'='GET') {
 const client=await google().getClient(); const response=await client.request<any>({url:`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.unomesa.android/${path}`,method,...(method==='POST'?{data:{}}:{}),timeout:15000,retry:true});return response.data;
}
export async function verifyGoogle(reference:string):Promise<StoreProof> {
 if(!reference||reference.length>4096||/[\s\x00-\x1f]/.test(reference))throw new Error('GOOGLE_TOKEN');
 const data=await googleRequest(`purchases/subscriptionsv2/tokens/${encodeURIComponent(reference)}`);
 const mode=data.testPurchase ? 'test':'live'; if(mode!==storeMode('google_play'))throw new Error('GOOGLE_ENVIRONMENT');
 // Pending payments never grant access and are never acknowledged.
 if(['SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'].includes(data.subscriptionState))throw new BillingError('El pago todavía está pendiente en Google Play.',409,'STORE_PENDING');
 // Deferred replacements include the old paid item (with expiry) and a future
 // item without expiry. Grant only the paid item until the effective renewal.
 const items=(data.lineItems||[]).filter((i:any)=>Number.isFinite(Date.parse(i.expiryTime))).sort((a:any,b:any)=>Date.parse(b.expiryTime)-Date.parse(a.expiryTime));
 if(!items.length||items.filter((i:any)=>Date.parse(i.expiryTime)>Date.now()).length>1)throw new Error('GOOGLE_LINE_ITEMS');const item=items[0];
 const product=storeProduct('google_play',item.productId,item.offerDetails?.basePlanId);
 const until=Date.parse(item.expiryTime);if(!Number.isFinite(until))throw new Error('GOOGLE_EXPIRY');
 const accountToken=data.externalAccountIdentifiers?.obfuscatedExternalAccountId;if(!accountToken)throw new Error('GOOGLE_BINDING');
 const active=['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'].includes(data.subscriptionState);
 return {provider:'google_play',mode,external:tokenHash(reference),reference,accountToken,product:item.productId,plan:product.plan,cycle:product.cycle,branches:product.branches,active,ended:data.subscriptionState==='SUBSCRIPTION_STATE_EXPIRED',until:new Date(until).toISOString(),cancel:!item.autoRenewingPlan?.autoRenewEnabled&&!item.deferredItemReplacement,
 linked:data.linkedPurchaseToken?tokenHash(data.linkedPurchaseToken):undefined,
 acknowledge:data.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING'&&active?async()=>{await googleRequest(`purchases/subscriptions/${encodeURIComponent(item.productId)}/tokens/${encodeURIComponent(reference)}:acknowledge`,'POST');}:undefined};
}
export async function verifyGooglePush(authorization:string|null) {
 const token=authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)throw new BillingError('Unauthorized',401);
 const ticket=await new OAuth2Client().verifyIdToken({idToken:token,audience:setting('GOOGLE_PLAY_PUSH_AUDIENCE')});const data=ticket.getPayload();
 if(!data?.email_verified||data.email!==setting('GOOGLE_PLAY_PUSH_SERVICE_ACCOUNT')||!['accounts.google.com','https://accounts.google.com'].includes(data.iss))throw new BillingError('Unauthorized',401);
}
export const verifyStore=(provider:StoreProvider,reference:string)=>provider==='apple'?verifyApple(reference):verifyGoogle(reference);
