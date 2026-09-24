import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { siteOrigin } from '@/lib/site-origin';
import { serverClients, requestBody } from '@/lib/billing-server';
export const runtime = 'nodejs';
export const maxDuration = 30;
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
function smtpConfig() {
 const { MRMAA_SMTP_HOST: host, MRMAA_SMTP_USER: user, MRMAA_SMTP_PASSWORD: pass, MRMAA_SMTP_FROM: from } = process.env;
 const port = Number(process.env.MRMAA_SMTP_PORT || 465);
 if (!host || !user || !pass || !from || ![465,587].includes(port)) throw new Error('EMAIL_CONFIG');
 return { host, port, user, pass, from };
}
async function context(req: NextRequest) {
 const token = req.headers.get('authorization')?.replace(/^Bearer /,'');
 if (!token) throw new Error('EMAIL_AUTH');
 const { admin, client } = serverClients(token);
 const verified = await client.auth.getUser(token);
 const user = verified.data.user;
 if (verified.error || !user?.email || !user.email_confirmed_at) throw new Error('EMAIL_AUTH');
 const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
 if (claims.sub !== user.id || !/^[a-f0-9-]{36}$/i.test(claims.session_id || '')) throw new Error('EMAIL_AUTH');
 const alive = await client.rpc('v2_session_alive');
 if (alive.error || alive.data !== true) throw new Error('EMAIL_AUTH');
 // A magic link / recovery session plus email would not prove a password.
 const password = Array.isArray(claims.amr) && claims.amr.some((x: {method?:string}) => x.method === 'password');
 return { admin, client, user, session: claims.session_id as string, password, accessToken:token };
}
export async function GET(req: NextRequest) {
 try {
  const { admin, client, user, password } = await context(req);
  const [settings, allowed] = await Promise.all([
   admin.from('v2_email_security').select('enabled').eq('user_id',user.id).maybeSingle(),
   client.rpc('v2_mfa_session_allowed'),
  ]);
  if (settings.error || allowed.error) throw new Error('EMAIL_CONFIG');
  let configured = true; try { smtpConfig(); } catch { configured = false; }
  return reply({ enabled: settings.data?.enabled === true || user.factors?.some(f=>f.status==='verified') === true,
   allowed: allowed.data === true, configured, password });
 } catch { return reply({ error: 'EMAIL_UNAVAILABLE' },503); }
}
export async function POST(req: NextRequest) {
 try {
  const body = await requestBody(req);
  const { admin, client, user, session, password, accessToken } = await context(req);
  if (String(body.action || '').startsWith('account_email_')) {
   if (!password) return reply({error:'EMAIL_PASSWORD'},403);
   const allowed = await client.rpc('v2_mfa_session_allowed');
   if (allowed.error || allowed.data !== true) return reply({error:'EMAIL_AUTH'},403);
   return await accountEmail(body, admin, user.id, user.email!, session, accessToken);
  }
  if (body.action === 'support_resolved_notify') return await notifyResolvedSupport(body, admin, client, user.id);
  if (body.action === 'support_notify') return await notifySupport(body, admin, client, user.id);
  if (!password) return reply({error:'EMAIL_PASSWORD'},403);
  if (!['send','verify'].includes(body.action) || !['enable','disable','login'].includes(body.purpose)) return reply({error:'EMAIL_INPUT'},400);
  const config = smtpConfig();
  const rate = await admin.rpc('v2_take_rate_limit', {p_bucket:body.action==='send'?'email-send':'email-verify',p_subject_hash:createHash('sha256').update(user.id).digest('hex'),p_limit:body.action==='send'?5:15,p_window_seconds:body.action==='send'?3600:600});
  if (rate.error) throw new Error('EMAIL_UNAVAILABLE');
  if (!rate.data) return reply({error:'EMAIL_RATE'},429);
  const code = body.action==='send' ? String(randomInt(100000,1000000)) : String(body.code || '');
  if (!/^\d{6}$/.test(code)) return reply({error:'EMAIL_INPUT'},400);
  // Secret salt prevents offline enumeration of the short code from a DB export.
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const hash = createHash('sha256').update([secret,user.id,session,body.purpose,code].join('|')).digest('hex');
  const result = await admin.rpc('v2_email_challenge',{p_user:user.id,p_session:session,p_email:user.email!,p_purpose:body.purpose,p_hash:hash,p_issue:body.action==='send'});
  if (result.error) throw new Error('EMAIL_UNAVAILABLE');
  if (result.data === 'wait') return reply({error:'EMAIL_WAIT'},429);
  if (body.action==='verify') {
   if (result.data!=='verified') return reply({error:'EMAIL_INVALID'},400);
   // Email proof migrates legacy TOTP without requiring the lost device.
   for (const factor of user.factors || []) {
    const removed = await admin.auth.admin.mfa.deleteFactor({userId:user.id,id:factor.id});
    if (removed.error) throw new Error('EMAIL_UNAVAILABLE');
   }
   return reply({verified:true});
  }
  if (result.data!=='sent') throw new Error('EMAIL_UNAVAILABLE');
  const en = body.language==='en';
  const transport = nodemailer.createTransport({host:config.host,port:config.port,secure:config.port===465,requireTLS:true,
   auth:{user:config.user,pass:config.pass},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,
   disableFileAccess:true,disableUrlAccess:true});
  try {
   await transport.sendMail({from:config.from,to:user.email!,subject:en?'MRMAA · Verification code':'MRMAA · Código de verificación',
    text:en?`Your MRMAA code is: ${code}\n\nIt expires in 10 minutes and can only be used once. Never share this code. If you did not request it, review your password.`:
     `Su código de MRMAA es: ${code}\n\nVence en 10 minutos y solo puede utilizarse una vez. No comparta este código. Si no lo solicitó, revise su contraseña.`});
  } finally { transport.close(); }
  return reply({sent:true});
 } catch { return reply({error:'EMAIL_UNAVAILABLE'},503); }
}

// Email changes never call the browser's updateUser(email) flow. Both inbox
// codes are bound to one verified Auth session, request ID and destination.
async function accountEmail(body: Record<string, any>, admin: ReturnType<typeof serverClients>['admin'], actor: string, currentEmail: string, session: string, accessToken: string) {
 const action = body.action;
 if (!['account_email_status','account_email_start','account_email_verify','account_email_cancel'].includes(action)) return reply({error:'EMAIL_INPUT'},400);
 const row = async () => {
  const result = await admin.from('v2_account_email_changes').select('request_id,session_id,old_email,new_email,expires_at,state').eq('user_id',actor).maybeSingle();
  if (result.error) throw new Error('EMAIL_UNAVAILABLE');
  return result.data;
 };
 if (action === 'account_email_status') {
  const c = await row();
  return reply({email:currentEmail, pending: c && c.session_id===session && ['sending','ready','applying'].includes(c.state) && Date.parse(c.expires_at)>Date.now()
   ? {id:c.request_id,old_email:c.old_email,new_email:c.new_email,expires_at:c.expires_at} : null,
   elsewhere:Boolean(c && c.session_id!==session && ['sending','ready','applying'].includes(c.state) && Date.parse(c.expires_at)>Date.now())});
 }
 const rate = await admin.rpc('v2_take_rate_limit',{p_bucket:action==='account_email_start'?'account-email-send':'account-email-verify',p_subject_hash:createHash('sha256').update(actor).digest('hex'),p_limit:action==='account_email_start'?5:15,p_window_seconds:action==='account_email_start'?3600:600});
 if (rate.error) throw new Error('EMAIL_UNAVAILABLE');
 if (!rate.data) return reply({error:'EMAIL_RATE'},429);
 const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!secret) throw new Error('EMAIL_CONFIG');
 const hash = (id:string,oldEmail:string,newEmail:string,side:string,code:string) => createHmac('sha256',secret).update(JSON.stringify(['account-email-v1',actor,session,id,oldEmail,newEmail,side,code])).digest('hex');
 const send = async(to:string,subject:string,text:string) => {
  const config=smtpConfig();
  const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:config.port===465,requireTLS:true,auth:{user:config.user,pass:config.pass},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true});
  try {await transport.sendMail({from:config.from,to,subject,text});} finally {transport.close();}
 };
 const en = body.language==='en';
 if (action === 'account_email_start') {
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const repeated=typeof body.repeat_email==='string'?body.repeat_email.trim().toLowerCase():'';
  if (!email || email.length>254 || email.split('@')[0].length>64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email) || email!==repeated || email===currentEmail.toLowerCase()) return reply({error:'EMAIL_CHANGE_ADDRESS'},400);
  smtpConfig();
  const destinationRate=await admin.rpc('v2_take_rate_limit',{p_bucket:'account-email-destination',p_subject_hash:createHash('sha256').update(email).digest('hex'),p_limit:5,p_window_seconds:3600});
  if(destinationRate.error)throw new Error('EMAIL_UNAVAILABLE');
  if(!destinationRate.data)return reply({error:'EMAIL_RATE'},429);
  const id=randomUUID(), oldCode=String(randomInt(100000,1000000));
  let newCode=String(randomInt(100000,1000000));while(newCode===oldCode)newCode=String(randomInt(100000,1000000));
  const issued=await admin.rpc('v2_account_email_issue',{p_user:actor,p_session:session,p_request:id,p_old:currentEmail,p_new:email,p_old_hash:hash(id,currentEmail,email,'old',oldCode),p_new_hash:hash(id,currentEmail,email,'new',newCode)});
  if(issued.error)throw new Error('EMAIL_UNAVAILABLE');
  if(issued.data==='wait')return reply({error:'EMAIL_WAIT'},429);
  if(issued.data!=='issued')return reply({error:'EMAIL_CHANGE_ADDRESS'},400);
  const instructions=en?'Enter this code only in the MRMAA session where you requested the email change. It expires in 10 minutes. Never share it. If you did not request this, ignore this email; your email address has not changed.':'Introduzca este código únicamente en la sesión de MRMAA donde solicitó cambiar el correo. Vence en 10 minutos. No lo comparta. Si no lo solicitó, ignore este mensaje; su correo de acceso no ha cambiado.';
  const sent=await Promise.allSettled([
   send(currentEmail,en?'MRMAA · Authorize email change':'MRMAA · Autorizar cambio de correo',`${en?'Current email code':'Código del correo actual'}: ${oldCode}\n\n${en?'Requested new email':'Nuevo correo solicitado'}: ${email}\n\n${instructions}`),
   send(email,en?'MRMAA · Verify your new email':'MRMAA · Verificar correo nuevo',`${en?'New email code':'Código del correo nuevo'}: ${newCode}\n\n${instructions}`),
  ]);
  if(sent.some(result=>result.status==='rejected')) {
   await admin.rpc('v2_account_email_cancel',{p_user:actor,p_session:session,p_request:id});
   return reply({error:'EMAIL_CHANGE_DELIVERY'},503);
  }
  const ready=await admin.from('v2_account_email_changes').update({state:'ready'}).eq('user_id',actor).eq('request_id',id).eq('state','sending').select('expires_at').single();
  if(ready.error)throw new Error('EMAIL_UNAVAILABLE');
  return reply({pending:{id,old_email:currentEmail,new_email:email,expires_at:ready.data.expires_at}});
 }
 const id=String(body.id||'');
 if(!/^[a-f0-9-]{36}$/i.test(id))return reply({error:'EMAIL_INPUT'},400);
 const c=await row();
 if(!c || c.request_id!==id || c.session_id!==session)return reply({error:'EMAIL_CHANGE_INVALID'},400);
 if(action==='account_email_cancel') {
  const cancelled=await admin.rpc('v2_account_email_cancel',{p_user:actor,p_session:session,p_request:id});
  if(cancelled.error)throw new Error('EMAIL_UNAVAILABLE');
  if(cancelled.data==='completed')return reply({completed:true,email:c.new_email});
  if(cancelled.data!=='cancelled')return reply({error:'EMAIL_CHANGE_INVALID'},400);
  return reply({cancelled:true,email:currentEmail});
 }
 const oldCode=String(body.old_code||''),newCode=String(body.new_code||'');
 if(!/^\d{6}$/.test(oldCode)||!/^\d{6}$/.test(newCode))return reply({error:'EMAIL_CHANGE_INVALID'},400);
 const verified=await admin.rpc('v2_account_email_verify',{p_user:actor,p_session:session,p_request:id,p_old_hash:hash(id,c.old_email,c.new_email,'old',oldCode),p_new_hash:hash(id,c.old_email,c.new_email,'new',newCode)});
 if(verified.error)throw new Error('EMAIL_UNAVAILABLE');
 if(verified.data==='completed')return reply({completed:true,email:c.new_email});
 if(verified.data==='wait')return reply({error:'EMAIL_WAIT'},429);
 if(verified.data!=='approved')return reply({error:'EMAIL_CHANGE_INVALID'},400);
 // The Auth API maintains its own identities; the database guard consumes the
 // single-use approval in that same transaction and rejects legacy links.
 const changed=await admin.auth.admin.updateUserById(actor,{email:c.new_email,email_confirm:true});
 if(changed.error) {
  const latest=await row();
  if(latest?.request_id===id && latest.state==='completed')return reply({completed:true,email:c.new_email});
  await admin.from('v2_account_email_changes').update({state:'ready',approved_until:null}).eq('user_id',actor).eq('request_id',id).eq('state','applying');
  return reply({error:'EMAIL_CHANGE_RETRY'},503);
 }
 const completed=await row();
 if(completed?.request_id!==id || completed.state!=='completed')throw new Error('EMAIL_UNAVAILABLE');
 // SQL has already blocked other sessions in MRMAA atomically. Also revoke
 // their Auth refresh sessions; a provider failure must not undo the change.
 try {await admin.auth.admin.signOut(accessToken,'others');} catch { /* MRMAA revocations remain effective. */ }
 // Notification failure cannot undo an already completed account change.
 let notified=true;
 try {await send(c.old_email,en?'MRMAA · Email address changed':'MRMAA · Correo de acceso actualizado',en?`Your MRMAA login email was changed to ${c.new_email}. Other sessions have been closed. If you did not make this change, contact support@mrmaa.com.`:`Su correo de acceso a MRMAA cambió a ${c.new_email}. Se cerraron las demás sesiones. Si no realizó este cambio, contacte a support@mrmaa.com.`);} catch {notified=false;}
 return reply({completed:true,email:c.new_email,notified});
}

// Authorization and notification are separate: a mail failure never loses the grant.
async function notifySupport(body: Record<string, any>, admin: ReturnType<typeof serverClients>['admin'], client: ReturnType<typeof serverClients>['client'], actor: string) {
 const id=String(body.id||''), restaurant=String(body.restaurant_id||'');
 if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-f0-9-]{36}$/i.test(restaurant))return reply({error:'SUPPORT_INPUT'},400);
 const permission=await client.rpc('v2_current_admin',{target_restaurant:restaurant});
 if(permission.error||permission.data!==true)return reply({error:'SUPPORT_DENIED'},403);
 const grant=await admin.from('v2_support_grants').select('id,restaurant_id,permission,reason,expires_at,revoked_at,notified_at').eq('id',id).eq('restaurant_id',restaurant).maybeSingle();
 if(grant.error||!grant.data||grant.data.revoked_at||Date.parse(grant.data.expires_at)<=Date.now())return reply({error:'SUPPORT_UNAVAILABLE'},403);
 if(grant.data.notified_at)return reply({sent:true});
 const rate=await admin.rpc('v2_take_rate_limit',{p_bucket:'support-notify',p_subject_hash:createHash('sha256').update(actor).digest('hex'),p_limit:10,p_window_seconds:3600});
 if(rate.error||!rate.data)return reply({error:'EMAIL_RATE'},429);
 const config=smtpConfig(), claim=new Date().toISOString();
 const claimed=await admin.from('v2_support_grants').update({notification_claimed_at:claim}).eq('id',id).is('notified_at',null).is('revoked_at',null).gt('expires_at',claim).or(`notification_claimed_at.is.null,notification_claimed_at.lt.${new Date(Date.now()-120000).toISOString()}`).select('id').maybeSingle();
 if(claimed.error||!claimed.data)return reply({error:'EMAIL_WAIT'},429);
 const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:config.port===465,requireTLS:true,auth:{user:config.user,pass:config.pass},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true});
 try {
  const r=await admin.from('v2_restaurants').select('name').eq('id',restaurant).single();
  if(r.error)throw new Error('SUPPORT_UNAVAILABLE');
  const link=new URL('/',siteOrigin());link.searchParams.set('support',id);link.searchParams.set('login','1');
  const en=body.language==='en';
  await transport.sendMail({from:config.from,to:'support@mrmaa.com',subject:en?'MRMAA · Authorized support request':'MRMAA · Solicitud de soporte autorizada',text:
   `${r.data.name}\n\n${grant.data.reason}\n\n${en?'Permission':'Permiso'}: ${grant.data.permission==='edit'?(en?'View and edit':'Ver y editar'):(en?'View only':'Solo lectura')}\n${en?'Expires':'Vence'}: ${grant.data.expires_at}\n\n${en?'Open restaurant':'Abrir restaurante'}: ${link.toString()}\n\n${en?'Sign in with the authorized support account and complete email verification. This link alone does not grant access.':'Ingrese con la cuenta de soporte autorizada y complete la verificación por correo. El enlace por sí solo no concede acceso.'}`});
  const saved=await admin.from('v2_support_grants').update({notified_at:new Date().toISOString(),notification_claimed_at:null}).eq('id',id).eq('notification_claimed_at',claim);
  if(saved.error)throw new Error('SUPPORT_NOTIFICATION_STATUS');
  return reply({sent:true});
 } catch {
  await admin.from('v2_support_grants').update({notification_claimed_at:null}).eq('id',id).eq('notification_claimed_at',claim);
  return reply({error:'SUPPORT_EMAIL_FAILED'},503);
 } finally {transport.close();}
}

async function notifyResolvedSupport(body: Record<string, any>, admin: ReturnType<typeof serverClients>['admin'], client: ReturnType<typeof serverClients>['client'], actor:string) {
 const id=String(body.id||'');
 if(!/^[a-f0-9-]{36}$/i.test(id))return reply({error:'SUPPORT_INPUT'},400);
 const agent=await client.rpc('v2_is_support_agent');
 const allowed=await client.rpc('v2_mfa_session_allowed');
 if(agent.error||agent.data!==true||allowed.error||allowed.data!==true)return reply({error:'SUPPORT_DENIED'},403);
 const grant=await admin.from('v2_support_grants').select('id,restaurant_id,resolved_at,resolution_note,resolution_notified_at').eq('id',id).eq('agent_id',actor).maybeSingle();
 if(grant.error||!grant.data?.resolved_at)return reply({error:'SUPPORT_UNAVAILABLE'},403);
 if(grant.data.resolution_notified_at)return reply({sent:true});
 const rate=await admin.rpc('v2_take_rate_limit',{p_bucket:'support-resolved',p_subject_hash:createHash('sha256').update(actor).digest('hex'),p_limit:10,p_window_seconds:3600});
 if(rate.error||!rate.data)return reply({error:'EMAIL_RATE'},429);
 const config=smtpConfig(),claim=new Date().toISOString();
 const claimed=await admin.from('v2_support_grants').update({resolution_claimed_at:claim}).eq('id',id).is('resolution_notified_at',null).or(`resolution_claimed_at.is.null,resolution_claimed_at.lt.${new Date(Date.now()-120000).toISOString()}`).select('id').maybeSingle();
 if(claimed.error||!claimed.data)return reply({error:'EMAIL_WAIT'},429);
 const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:config.port===465,requireTLS:true,auth:{user:config.user,pass:config.pass},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true});
 try {
  const r=await admin.from('v2_restaurants').select('name,owner_id').eq('id',grant.data.restaurant_id).single();
  if(r.error||!r.data?.owner_id)throw new Error('RECIPIENT');
  const owner=await admin.auth.admin.getUserById(r.data.owner_id);
  if(owner.error||!owner.data.user?.email||!owner.data.user.email_confirmed_at)throw new Error('RECIPIENT');
  const en=body.language==='en';
  await transport.sendMail({from:config.from,to:owner.data.user.email,subject:en?'MRMAA · Support request resolved':'MRMAA · Solicitud de soporte resuelta',text:`${r.data.name}\n\n${en?'Your support request has been marked as resolved.':'Su solicitud de soporte se marcó como resuelta.'}\n\n${grant.data.resolution_note}\n\n${en?'Temporary support access has ended. Review the result in Settings → Support.':'El acceso temporal de soporte ha finalizado. Revise el resultado en Configuración → Soporte.'}\n${siteOrigin()}`});
  const saved=await admin.from('v2_support_grants').update({resolution_notified_at:new Date().toISOString(),resolution_claimed_at:null}).eq('id',id).eq('resolution_claimed_at',claim);
  if(saved.error)throw new Error('STATUS');
  return reply({sent:true});
 } catch {
  await admin.from('v2_support_grants').update({resolution_claimed_at:null}).eq('id',id).eq('resolution_claimed_at',claim);
  return reply({error:'SUPPORT_EMAIL_FAILED'},503);
 } finally {transport.close();}
}
