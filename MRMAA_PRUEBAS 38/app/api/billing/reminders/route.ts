import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { mailSender, brandMail } from '@/lib/mail-brand';
import { siteOrigin } from '@/lib/site-origin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(req: NextRequest) {
 const expected=Buffer.from(process.env.CRON_SECRET || '');
 const received=Buffer.from(req.headers.get('authorization')?.replace(/^Bearer\s+/i,'') || '');
 if (!expected.length || expected.length!==received.length || !timingSafeEqual(expected,received)) return NextResponse.json({error:'Unauthorized'},{status:401});
 const {MRMAA_SMTP_HOST:host,MRMAA_SMTP_USER:user,MRMAA_SMTP_PASSWORD:pass}=process.env;
 const from=mailSender("support");
 const port=Number(process.env.MRMAA_SMTP_PORT||465);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!host||!user||!pass||!from||![465,587].includes(port)||!url||!key) return NextResponse.json({error:'REMINDER_CONFIG_MISSING'},{status:503});
 let sent=0,failed=0,skipped=0;
 const transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:true,auth:{user,pass},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:8000,disableFileAccess:true,disableUrlAccess:true});
 try {
  const link=siteOrigin()+'/?billing=return';
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(5000)})}});
  // Validate SMTP before reserving notices. A reserved notice is never sent twice
  // automatically: SMTP cannot guarantee idempotency after an ambiguous timeout.
  await transport.verify();
  const deadline=Date.now()+35000;
  for(let i=0;i<20 && Date.now()<deadline;i++) {
   const claim=await admin.rpc('v2_claim_expiry_notice');
   if(claim.error) throw new Error('REMINDER_CLAIM_FAILED');
   const n=claim.data; if(!n) break;
   let status='failed';
   try {
    const [current,owner,exempt]=await Promise.all([
     admin.from('v2_restaurants').select('owner_id,billing_cancel_at_period_end,billing_current_period_end,access_status').eq('id',n.restaurant_id).single(),
     admin.auth.admin.getUserById(n.owner_id),
     admin.rpc('v2_expiry_notice_valid',{p_notice:n.id}),
    ]);
    if(current.error||owner.error||exempt.error) throw new Error('REMINDER_RECHECK_FAILED');
    const r=current.data;
    if(exempt.data!==true||r.owner_id!==n.owner_id||!r.billing_cancel_at_period_end||Date.parse(r.billing_current_period_end)!==Date.parse(n.paid_until)||Date.parse(n.paid_until)<=Date.now()||['deleted','suspended'].includes(r.access_status)||owner.data.user?.email!==n.email) {status='skipped';skipped++;}
    else {
     const en=n.language==='en';
     const date=new Intl.DateTimeFormat(en?'en-US':'es-GT',{dateStyle:'long',timeStyle:'short',timeZone:'UTC'}).format(new Date(n.paid_until))+' UTC';
     const subject=en?'UnoMesa · Your paid period is ending':'UnoMesa · Su período pagado está por terminar';
     const text=en?`${n.name}\n\nYour renewal is canceled. Your paid period ends on ${date}. To keep access to your restaurant modules, reactivate your subscription before that date.\n\nManage subscription (sign in as the restaurant owner):\n${link}\n\nIf you already reactivated it, check the current status in UnoMesa.\nSupport: support@unomesa.com`:`${n.name}\n\nSu renovación está cancelada. El período pagado termina el ${date}. Para conservar el acceso a los módulos de su restaurante, reactive la suscripción antes de esa fecha.\n\nGestionar suscripción (ingrese como administrador principal):\n${link}\n\nSi ya la reactivó, consulte el estado actual en UnoMesa.\nSoporte: support@unomesa.com`;
     await transport.sendMail(brandMail({from,to:n.email,subject,text,messageId:`<expiry-${n.id}@mrmaa.com>`}));status='sent';sent++;
    }
   } catch {failed++;}
   const finish=await admin.from('v2_expiry_notices').update({status,finished_at:new Date().toISOString()}).eq('id',n.id).eq('status','sending');
   if(finish.error) throw new Error('REMINDER_FINISH_FAILED');
  }
  if(failed) console.error('MRMAA expiry reminders failed',{failed});
  return NextResponse.json({sent,failed,skipped},{status:failed?503:200});
 } catch {console.error('MRMAA expiry reminders unavailable');return NextResponse.json({error:'REMINDER_FAILED',sent,failed,skipped},{status:503});}
 finally {transport.close();}
}
