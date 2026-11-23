import { randomUUID } from 'node:crypto';
import { registrationHistory } from '@/lib/registration-guard';
import { registrationFailure } from '@/lib/registration-error';
import { NextRequest, NextResponse } from 'next/server';
import { BillingError, requestBody, serverClients, strictRateLimit } from '@/lib/billing-server';
import { isPlan, isBillingInterval, PUBLIC_SIGNUP_ENABLED } from '@/lib/plans';
import { siteOrigin } from '@/lib/site-origin';

export async function POST(req: NextRequest) {
 const reference=randomUUID(); let retryAfter=0;
 try {
  if (!PUBLIC_SIGNUP_ENABLED) throw new BillingError('El registro está temporalmente cerrado.',403);
  const body=await requestBody(req), resend=body.action==='resend';
  if (body.action!==undefined && body.action!=='resend') throw new BillingError('Solicitud no válida.');
  if (typeof body.email!=='string'||body.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw new BillingError('Ingrese un correo válido.');
  if (!resend) {
   if (!isPlan(body.plan_code)||!isBillingInterval(body.billing_cycle)||!['es','en'].includes(body.language)||!['GTQ','USD','MXN'].includes(body.currency)) throw new BillingError('Revise el plan, idioma y moneda seleccionados.');
   if (typeof body.password!=='string'||body.password.length<8||body.password.length>128||!/[a-z]/.test(body.password)||!/[A-Z]/.test(body.password)||!/[0-9]/.test(body.password)||!/[^A-Za-z0-9]/.test(body.password)) throw new BillingError('Use 8 caracteres o más, con mayúscula, minúscula, número y carácter especial.');
   if (body.accepted!==true) throw new BillingError('Debe aceptar los Términos y la Política de privacidad.');
   if (typeof body.full_name!=='string'||!body.full_name.trim()||typeof body.restaurant_name!=='string'||!body.restaurant_name.trim()) throw new BillingError('Revise su nombre, restaurante y correo.');
  }
  await strictRateLimit(req,'register',5);
  const {admin,client}=serverClients(),email=body.email.trim().toLowerCase();
  const redirect=siteOrigin(new URL(req.url).origin);
  const exists=()=>new BillingError('Esta cuenta ya está registrada. Inicie sesión con su método habitual o recupere su contraseña. Su prueba y suscripción no se reinician.',409,'ACCOUNT_EXISTS');
  if (await registrationHistory(admin,email)!=='new') throw exists();
  const {password,captchaToken,action,...details}=body;
  const intent=await admin.rpc('v2_registration_acquire',{p_data:{...details,email,plan_code:'advanced',billing_cycle:'month'},p_resend:resend});
  if (intent.error) {
   console.error('[registration]',{reference,stage:'intent',code:intent.error.code});
   throw new BillingError('No se pudo preparar el registro. Contacte a soporte de UnoMesa.',503,'REGISTRATION_UNAVAILABLE');
  }
  const lease=intent.data;
  if (lease?.state==='existing') throw exists();
  if (lease?.state==='retry_registration') throw new BillingError('No se completó el registro anterior. Vuelva al formulario e intente crear la cuenta otra vez.',409,'REGISTRATION_RETRY_REQUIRED');
  if (lease?.state==='busy') {
   retryAfter=Math.max(1,Math.min(300,Number(lease.retry_after)||90));
   throw new BillingError('Hay un intento reciente en proceso. Espere el tiempo indicado antes de reintentar. Este aviso no confirma que se haya enviado un correo.',429,'REGISTRATION_IN_PROGRESS');
  }
  if (!['signup','resend'].includes(lease?.state)||!lease.attempt_id||!lease.registration_token) throw new BillingError('No se pudo preparar el registro.',503);
  const release=async(wait:number)=>{
   try {const r=await admin.rpc('v2_registration_release',{p_email:email,p_attempt:lease.attempt_id,p_wait:wait});
    if(r.error) console.error('[registration]',{reference,stage:'release',code:r.error.code});
   } catch {console.error('[registration]',{reference,stage:'release',code:'NETWORK_ERROR'});}
  };
  let providerError: {code?:string;status?:number;name?:string}|null=null, requiresEmailConfirmation=true;
  try {
   if (lease.state==='resend') {
    const r=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:redirect,captchaToken:typeof captchaToken==='string'?captchaToken:undefined}});
    providerError=r.error;
   } else {
    const r=await client.auth.signUp({email,password,options:{emailRedirectTo:redirect,captchaToken:typeof captchaToken==='string'?captchaToken:undefined,
     data:{registration_token:lease.registration_token,full_name:lease.full_name,language:lease.language}}});
    providerError=r.error;
    if(!providerError&&!r.data.user) providerError={code:'MISSING_AUTH_USER'};
    if(!providerError&&Array.isArray(r.data.user?.identities)&&r.data.user.identities.length===0) providerError={code:'user_already_exists'};
    requiresEmailConfirmation=!r.data.session;
   }
  } catch {providerError={code:'NETWORK_ERROR'};}
  if (providerError) {
   const failure=registrationFailure(providerError);retryAfter=failure.wait;
   console.error('[registration]',{reference,stage:lease.state,code:providerError.code||'UNKNOWN_AUTH_ERROR',httpStatus:providerError.status});
   await release(failure.wait);
   throw new BillingError(failure.message,failure.status,failure.code);
  }
  await release(60);
  // No automatic session, password, registration token or provider user data is returned.
  return NextResponse.json({ok:true,requiresEmailConfirmation,retryAfter:60},{headers:{'Cache-Control':'no-store'}});
 } catch(error) {
  const known=error instanceof BillingError;
  if(!known) console.error('[registration]',{reference,stage:'request',code:'UNEXPECTED_ERROR'});
  return NextResponse.json({error:known?error.message:'No se pudo crear la cuenta. Intente nuevamente.',code:known?error.code:'REGISTRATION_FAILED',reference,...(retryAfter?{retryAfter}:{})},
   {status:known?error.status:503,headers:{'Cache-Control':'no-store',...(retryAfter?{'Retry-After':String(retryAfter)}:{})}});
 }
}
