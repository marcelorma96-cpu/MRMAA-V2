import { NextRequest, NextResponse } from 'next/server';
import { serverClients, requestBody } from '@/lib/billing-server';
import { requireVerifiedMfa } from '@/lib/mfa';
import { permissionsFor } from '@/lib/permissions';
import { AI_MODEL, AI_OUTPUT_LIMIT, helpInput, helpInstructions, responseText } from '@/lib/assistant';
export const runtime='nodejs';
export const maxDuration=30;
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const enabled=()=>Boolean(process.env.OPENAI_API_KEY)&&process.env.MRMAA_AI_ENABLED!=='false';
async function context(req:NextRequest,id:unknown){
  if (!uuid(id)) throw new Error('AI_ACCESS');
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error('AI_ACCESS');
  const {admin,client}=serverClients(token);
  const verified=await client.auth.getUser(token);
  if(verified.error||!verified.data.user?.email_confirmed_at)throw new Error('AI_ACCESS');
  try{await requireVerifiedMfa(verified.data.user,token);}catch{throw new Error('AI_MFA');}
  const user=verified.data.user;
  const [membership,restaurant]=await Promise.all([
    client.from('v2_members').select('role,status').eq('restaurant_id',id).eq('user_id',user.id).maybeSingle(),
    client.from('v2_restaurants').select('plan_code').eq('id',id).maybeSingle(),
  ]);
  if(membership.error||restaurant.error)throw new Error('AI_UNAVAILABLE');
  if(!permissionsFor(membership.data?.role,membership.data?.status).canRead||!restaurant.data)throw new Error('AI_ACCESS');
  const allowed=await client.rpc('v2_billing_can_write',{p_restaurant:id});
  if(allowed.error)throw new Error('AI_UNAVAILABLE');
  if(!allowed.data)throw new Error('AI_ACCESS');
  return {admin,id,userId:user.id,role:membership.data!.role,plan:restaurant.data.plan_code};
}
async function quota(ctx:Awaited<ReturnType<typeof context>>,request?:string){
  const result=await ctx.admin.rpc('v2_ai_quota',{p_restaurant:ctx.id,p_user:ctx.userId,p_request:request||null});
  if(result.error)throw new Error(result.error.code==='42501'?'AI_ACCESS':'AI_UNAVAILABLE');
  return result.data;
}
function errorResponse(error:unknown){
  const code=error instanceof Error ? error.message : '';
  const safe=['AI_ACCESS','AI_MFA','AI_INPUT','AI_UNAVAILABLE'].includes(code)?code:'AI_UNAVAILABLE';
  return json({error:safe},safe==='AI_INPUT'?400:safe==='AI_ACCESS'||safe==='AI_MFA'?403:503);
}
export async function GET(req:NextRequest){
  try{const ctx=await context(req,req.nextUrl.searchParams.get('restaurant_id'));return json({...await quota(ctx),enabled:enabled()});}
  catch(error){return errorResponse(error);}
}
export async function POST(req:NextRequest){
  let ctx:Awaited<ReturnType<typeof context>>|undefined,requestId:string|undefined,reserved=false;
  try{
    const body=await requestBody(req);
    if(!body||!uuid(body.request_id))throw new Error('AI_INPUT');
    requestId=body.request_id;
    const input=helpInput(body.question,body.history);
    ctx=await context(req,body.restaurant_id);
    if(!enabled())return json({error:'AI_DISABLED'},503);
    const rate=await ctx.admin.rpc('v2_take_rate_limit',{p_bucket:'ai-help',p_subject_hash:ctx.userId,p_limit:8,p_window_seconds:60});
    if(rate.error)throw new Error('AI_UNAVAILABLE');
    if(!rate.data)return json({error:'AI_RATE'},429);
    const language=body.language==='en'?'en':'es';
    const instructions=helpInstructions(input.question,input.history,language,ctx.plan,ctx.role,typeof body.page==='string'?body.page:'');
    const state=await quota(ctx,requestId);
    if(state.state==='done')return json(state);
    if(state.state!=='reserved')return json({...state,error:state.state==='limit'?'AI_LIMIT':state.state==='failed'?'AI_FAILED':'AI_BUSY'},state.state==='limit'?429:409);
    reserved=true;
    // Exactly one provider call per reservation: no automatic retries, tools or business queries.
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({model:AI_MODEL,instructions,input:[...input.history,{role:'user',content:input.question}],
        max_output_tokens:AI_OUTPUT_LIMIT,reasoning:{effort:'none'},store:false,service_tier:'default'}),
      signal:AbortSignal.timeout(20000),
    });
    if(!response.ok)throw new Error('AI_PROVIDER');
    const answer=responseText(await response.json());
    const saved=await ctx.admin.from('v2_ai_requests').update({status:'done',answer}).eq('restaurant_id',ctx.id).eq('request_id',requestId).eq('user_id',ctx.userId).eq('status','pending').select('request_id');
    if(saved.error||saved.data?.length!==1)throw new Error('AI_PROVIDER');
    return json({...state,state:'done',answer});
  }catch(error){
    if(reserved&&ctx&&requestId){
      await ctx.admin.from('v2_ai_requests').update({status:'failed'}).eq('restaurant_id',ctx.id).eq('request_id',requestId).eq('status','pending');
      return json({error:'AI_FAILED'},502);
    }
    return errorResponse(error);
  }
}
