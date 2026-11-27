import { NextRequest,NextResponse } from 'next/server';
import { publicAdmin,sameOrigin } from '@/lib/public-server';
import { readBoundedJson,takeDistributedRateLimit,RequestSafetyError } from '@/lib/server-scale';
import { validSlug } from '@/lib/restaurant-public';
import { publicSubmissionFailure } from '@/lib/public-request-feedback';
import { validatePublicRequest,publicCatalogIssue } from '@/lib/public-request-input';
import { randomUUID } from 'node:crypto';
import { verifyPublicTurnstile,PublicTurnstileError } from '@/lib/public-turnstile';
export async function POST(req:NextRequest){const reference=randomUUID();let stage='origin';try{
 sameOrigin(req);stage='service-config';const admin=publicAdmin();stage='rate-limit';await takeDistributedRateLimit(admin,req,'public-quote:intake',5,300);
 stage='input';
 const b=await readBoundedJson(req,12000);if(b.website)return NextResponse.json({ok:true});
 if(!validSlug(String(b.slug||''))||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(b.id)))throw new RequestSafetyError('PUBLIC_INPUT');
 const input=validatePublicRequest(b);if(!input.data)throw new RequestSafetyError(input.error);
 stage='verification';
 await verifyPublicTurnstile({secret:process.env.TURNSTILE_SECRET_KEY,siteKey:process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,token:b.captchaToken,hostname:new URL(req.url).hostname});
 stage='intake';
 const result=await admin.rpc('v2_public_submit',{p_slug:b.slug,p_id:b.id,p_data:input.data});
 if(result.error){
  const failure=publicSubmissionFailure(result.error.message);
  if(failure.code==='PUBLIC_INPUT'){
   try{const page=await admin.rpc('v2_public_page',{p_slug:b.slug});if(!page.error){const issue=publicCatalogIssue(input.data,page.data?.content);if(issue){failure.code=issue;failure.status=issue==='PUBLIC_NOT_FOUND'?404:400;}}}catch{/* Keep the original rejection if the read is unavailable. */}
  }
  throw new RequestSafetyError(failure.code,failure.status);
 }
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
 const verification=e instanceof PublicTurnstileError;
 const status=verification?e.status:e instanceof RequestSafetyError?e.status:503;
 const code=verification?e.message:status>=500?'SERVICE_UNAVAILABLE':e instanceof RequestSafetyError?e.message:'SERVICE_UNAVAILABLE';
 const diagnostic=verification||status>=500||code==='INVALID_ORIGIN'||code==='PUBLIC_INPUT';
 if(diagnostic)console.error('[public-restaurant]',{reference,stage,code,...(verification?{verification:e.diagnostic()}:{})});
 return NextResponse.json({error:code,...(diagnostic?{reference}:{})},{status,headers:{'Cache-Control':'no-store'}});
}}
