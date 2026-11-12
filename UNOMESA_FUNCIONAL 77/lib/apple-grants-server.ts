// Server only. Apple refresh tokens are solely for revocation after actual
// deletion of the Auth identity (never after leaving a restaurant or signing out).
import { createCipheriv, createDecipheriv, createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
const APP_ID = 'com.unomesa.app', ISSUER = 'https://appleid.apple.com', TABLE='v2_apple_grants';
function setting(name: string) {
  const v=process.env[name]?.trim(); if(!v) throw new Error('APPLE_SETUP'); return v;
}
function key() {
  const k=Buffer.from(setting('APPLE_LOGIN_GRANT_KEY'),'base64');
  if(k.length!==32) throw new Error('APPLE_SETUP'); return k;
}
function secret() {
  const team=setting('APPLE_LOGIN_TEAM_ID'), kid=setting('APPLE_LOGIN_KEY_ID');
  const iat=Math.floor(Date.now()/1000);
  const enc=(obj:object)=>Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned=enc({alg:'ES256',kid})+'.'+enc({iss:team,iat,exp:iat+300,aud:ISSUER,sub:APP_ID});
  return unsigned+'.'+sign('sha256',Buffer.from(unsigned),{key:createPrivateKey(setting('APPLE_LOGIN_PRIVATE_KEY').replace(/\\n/g,'\n')),dsaEncoding:'ieee-p1363'}).toString('base64url');
}
async function applePost(path:'token'|'revoke', fields:Record<string,string>) {
  return fetch(ISSUER+'/auth/'+path,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5500),
    body:new URLSearchParams({client_id:APP_ID,client_secret:secret(),...fields})});
}
function claimsFrom(token:string) {
  const parts=token.split('.'); if(parts.length!==3) throw new Error('APPLE_IDENTITY');
  return JSON.parse(Buffer.from(parts[1],'base64url').toString()) as Record<string,unknown>;
}
// The code is verified directly with Apple over TLS. The native ID token will
// also have its signature, audience, nonce and expiry verified by Supabase.
export async function exchangeAppleGrant(code:string, nativeToken:string, nonce:string) {
  key(); // fail before consuming the single-use code on a misconfigured deployment
  const res=await applePost('token',{grant_type:'authorization_code',code});
  if(!res.ok) throw new Error('APPLE_EXCHANGE');
  const grant=await res.json();
  if(typeof grant.id_token!=='string'||typeof grant.refresh_token!=='string'||!grant.refresh_token) throw new Error('APPLE_EXCHANGE');
  const trusted=claimsFrom(grant.id_token), native=claimsFrom(nativeToken);
  const hashed=createHash('sha256').update(nonce).digest('hex');
  if(trusted.iss!==ISSUER || trusted.aud!==APP_ID || typeof trusted.sub!=='string'||!trusted.sub ||
     typeof trusted.exp!=='number'||trusted.exp<=Date.now()/1000||
     native.iss!==ISSUER || native.aud!==APP_ID || native.sub!==trusted.sub || native.nonce!==hashed ||
     (trusted.nonce!==undefined && trusted.nonce!==hashed)) throw new Error('APPLE_IDENTITY');
  return {subject:trusted.sub,refresh:grant.refresh_token as string};
}
export function sealAppleToken(refresh:string, subjectHash:string){
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key(),iv);
  cipher.setAAD(Buffer.from(subjectHash));const encrypted=Buffer.concat([cipher.update(refresh,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(x=>x.toString('base64url')).join('.');
}
function openAppleToken(sealed:string,subjectHash:string){
  const [iv,tag,encrypted]=sealed.split('.').map(x=>Buffer.from(x,'base64url'));
  const decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAAD(Buffer.from(subjectHash));decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8');
}
export async function saveAppleGrant(db:SupabaseClient,user:string,subject:string,refresh:string) {
  const subjectHash=createHash('sha256').update(subject).digest('hex');
  const {error}=await db.from(TABLE).upsert({user_id:user,subject_hash:subjectHash,sealed_token:sealAppleToken(refresh,subjectHash)},{onConflict:'user_id'});
  if(error) throw new Error('APPLE_STORAGE');
}
export async function revokeDeletedAppleGrants(db:SupabaseClient) {
  // Limit and run in parallel; an unreachable Apple endpoint shouldn't stall housekeeping.
  const {data,error}=await db.from(TABLE).select('id,subject_hash,sealed_token').is('user_id',null).order('last_attempt',{nullsFirst:true}).limit(6);
  if(error) throw new Error('APPLE_STORAGE');
  const results=await Promise.allSettled((data||[]).map(async row=>{
    const claimed=await db.from(TABLE).update({last_attempt:new Date().toISOString()}).eq('id',row.id).is('user_id',null).select('id');
    if(claimed.error) throw new Error('APPLE_STORAGE'); if(!claimed.data?.length) return;
    const response=await applePost('revoke',{token:openAppleToken(row.sealed_token,row.subject_hash),token_type_hint:'refresh_token'});
    if(!response.ok) throw new Error('APPLE_REVOKE');
    const remove=await db.from(TABLE).delete().eq('id',row.id).is('user_id',null);
    if(remove.error) throw new Error('APPLE_STORAGE');
  }));
  if(results.some(r=>r.status==='rejected'))throw new Error('APPLE_RETRY');
}
