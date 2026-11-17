import { NextRequest, NextResponse } from 'next/server';
import { serverClients } from '@/lib/billing-server';
import { exchangeAppleGrant, saveAppleGrant } from '@/lib/apple-grants-server';
import { readBoundedJson, takeDistributedRateLimit, RequestSafetyError } from '@/lib/server-scale';
export const runtime='nodejs';
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export async function POST(req:NextRequest){
  if(process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED!=='true')return reply({error:'APPLE_DISABLED'},503);
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'APPLE_ORIGIN'},403);
  try{
    const body=await readBoundedJson(req,18000);
    if(typeof body.token!=='string'||body.token.length>11000 || typeof body.code!=='string'||!body.code||body.code.length>2048 ||
       typeof body.nonce!=='string'||!/^[0-9a-f]{64}$/.test(body.nonce)||
       (body.captcha!==undefined&&(typeof body.captcha!=='string'||body.captcha.length>3000)))return reply({error:'APPLE_INPUT'},400);
    const {admin,client}=serverClients();await takeDistributedRateLimit(admin,req,'apple-native-login',24,60);
    const grant=await exchangeAppleGrant(body.code,body.token,body.nonce);
    const {data,error}=await client.auth.signInWithIdToken({provider:'apple',token:body.token,nonce:body.nonce,options:{captchaToken:body.captcha}});
    if(error?.code==='captcha_failed')return reply({error:'captcha_failed'},403);
    if(error||!data.session||!data.user?.email_confirmed_at||!data.user.identities?.some(i=>i.provider==='apple'&&i.identity_data?.sub===grant.subject))return reply({error:'APPLE_IDENTITY'},401);
    await saveAppleGrant(admin,data.user.id,grant.subject,grant.refresh);
    // No Apple token, provider payload, or personal data in the response or logs.
    return reply({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
  }catch(error){return reply({error:'APPLE_LOGIN'},error instanceof RequestSafetyError?error.status:503);}
}
