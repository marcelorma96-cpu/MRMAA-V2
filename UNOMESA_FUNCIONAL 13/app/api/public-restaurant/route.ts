import { NextRequest,NextResponse } from 'next/server';
import { publicAdmin,sameOrigin } from '@/lib/public-server';
import { readBoundedJson,takeDistributedRateLimit,RequestSafetyError } from '@/lib/server-scale';
import { phoneDigits,validPhone,validSlug } from '@/lib/restaurant-public';
export async function POST(req:NextRequest){try{
 sameOrigin(req);const admin=publicAdmin();await takeDistributedRateLimit(admin,req,'public-quote:intake',5,300);
 const b=await readBoundedJson(req,12000);if(b.website)return NextResponse.json({ok:true});
 if(!validSlug(String(b.slug||''))||!/^[a-f0-9-]{36}$/i.test(String(b.id))||typeof b.name!=='string'||!b.name.trim()||b.name.length>160||typeof b.phone!=='string'||!validPhone(b.phone)||typeof b.email!=='string'||b.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||!/^\d{4}-\d{2}-\d{2}$/.test(b.event_date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.event_time)||!Number.isInteger(Number(b.guests))||Number(b.guests)<1||Number(b.guests)>100000||typeof b.menu!=='string'||b.menu.length>160||String(b.notes||'').length>2000||String(b.area||'').length>160)throw new RequestSafetyError('PUBLIC_INPUT');
 const secret=process.env.TURNSTILE_SECRET_KEY;
 if(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&!secret)throw new RequestSafetyError('SERVICE_UNAVAILABLE',503);
 if(secret){const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:String(b.captchaToken||'')}),signal:AbortSignal.timeout(10000)});const v=await verify.json();if(!v.success||v.hostname!==new URL(req.url).hostname)throw new RequestSafetyError('CAPTCHA',400);}
 const result=await admin.rpc('v2_public_submit',{p_slug:b.slug,p_id:b.id,p_data:{name:b.name.trim(),phone:phoneDigits(b.phone),email:b.email.trim(),event_date:b.event_date,event_time:b.event_time,guests:Number(b.guests),menu:b.menu,area:String(b.area||''),notes:String(b.notes||''),preference:b.preference}});
 if(result.error)throw new RequestSafetyError(/PUBLIC_NOT_FOUND/.test(result.error.message)?'PUBLIC_NOT_FOUND':'PUBLIC_INPUT');
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}catch(e){return NextResponse.json({error:e instanceof RequestSafetyError?e.message:'SERVICE_UNAVAILABLE'},{status:e instanceof RequestSafetyError?e.status:503,headers:{'Cache-Control':'no-store'}});}}
