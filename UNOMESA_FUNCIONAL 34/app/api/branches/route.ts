import {NextRequest,NextResponse} from 'next/server';
import {billingContext,requestBody,strictRateLimit,BillingError} from '@/lib/billing-server';
import {runBranchJobs} from '@/lib/branch-server';
export const maxDuration=30;
export async function POST(req:NextRequest){try{
 const b=await requestBody(req),{admin,user,restaurant}=await billingContext(req,b.restaurant_id);
 await strictRateLimit(req,'branches:'+user.id,30);
 let result;
 if(b.action==='create'){
  if(typeof b.request_id!=='string'||!/^[-0-9a-f]{36}$/i.test(b.request_id)||typeof b.name!=='string')throw new BillingError('Revise el nombre de la sucursal.');
  result=await admin.rpc('v2_branch_create',{p_root:restaurant.id,p_user:user.id,p_request:b.request_id,p_name:b.name,p_source:b.source_id||null,p_options:b.options||{}});
 }else if(b.action==='archive'||b.action==='restore'){
  result=await admin.rpc('v2_branch_archive',{p_restaurant:b.branch_id,p_user:user.id,p_archived:b.action==='archive'});
 }else if(b.action==='progress'){
  await runBranchJobs(admin,Date.now()+15000,restaurant.id);result={data:true,error:null};
 }else throw new BillingError('Operación no válida.');
 if(result.error){const code=result.error.message;
  const messages:Record<string,string>={BRANCH_ACCESS:'Solo el propietario principal puede administrar las sucursales.',BRANCH_SOURCE:'Seleccione una sucursal de esta empresa como origen.',BRANCH_CAPACITY:'Su paquete no tiene espacios disponibles. Amplíelo en Suscripción.',BRANCH_INPUT_OR_PLAN:'Necesita acceso Avanzado vigente y un nombre válido.',BRANCH_PRIMARY_OWNER:'El propietario principal debe conservar su acceso.'};
  throw new BillingError(messages[code]||'No se pudo completar la operación. No se borró información.',409,code.startsWith('BRANCH_')?code:'BRANCH_UNAVAILABLE');
 }
 return NextResponse.json({ok:true,restaurant_id:typeof result.data==='string'?result.data:undefined},{headers:{'Cache-Control':'no-store'}});
}catch(e){return NextResponse.json({error:e instanceof BillingError?e.message:'No se pudo cargar la cuenta. Intente nuevamente.'},{status:e instanceof BillingError?e.status:503});}}
