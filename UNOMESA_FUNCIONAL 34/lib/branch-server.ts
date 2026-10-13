import {BillingError, type serverClients} from './billing-server';
type Admin=ReturnType<typeof serverClients>['admin'];
async function copyBranchLogo(admin:Admin,job:any){
 if(job.stage!==0||!job.source_id||job.options?.settings!==true)return;
 const source=await admin.from('v2_restaurants').select('settings').eq('id',job.source_id).single();
 if(source.error)throw source.error;
 let logo=source.data.settings?.logo_data_url;
 if(!logo)return;
 if(!/^data:image\/(?:png|jpeg|webp);base64,/.test(logo)){
  const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!),url=new URL(logo);
  const prefix='/storage/v1/object/public/mrmaa-branding/';
  if(url.origin!==origin.origin||!url.pathname.startsWith(prefix))return;
  const path=decodeURIComponent(url.pathname.slice(prefix.length));
  if(!path.startsWith(job.source_id+'/')||path.split('/').some(x=>x==='..'||x==='.')||path.length>1024)throw new Error('BRANCH_ASSET');
  const target=`${job.target_id}/branch-${job.id}.${path.split('.').at(-1)?.replace(/[^a-z0-9]/gi,'').slice(0,8)||'png'}`;
  const copied=await admin.storage.from('mrmaa-branding').copy(path,target);
  if(copied.error && !/already exists|duplicate/i.test(copied.error.message))throw copied.error;
  logo=admin.storage.from('mrmaa-branding').getPublicUrl(target).data.publicUrl;
 }
 const save=await admin.rpc('v2_branch_set_logo',{p_job:job.id,p_logo:logo});if(save.error)throw save.error;
}
export async function runBranchJobs(admin:Admin,deadline:number,rootId?:string){
 let q=admin.from('v2_branch_jobs').select('id,source_id,target_id,stage,options').eq('status','pending').lte('retry_after',new Date().toISOString()).order('updated_at').order('id').limit(10);
 if(rootId)q=q.eq('root_id',rootId);
 const jobs=await q;if(jobs.error){if(jobs.error.code==='42P01')return 0;throw new Error('BRANCH_JOBS_UNAVAILABLE');}
 let steps=0;
 // Round-robin: one large import never blocks the other businesses.
 for(const job of jobs.data||[]){if(Date.now()>=deadline)break;
  try{
   await copyBranchLogo(admin,job);
   const step=await admin.rpc('v2_branch_copy_step',{p_job:job.id});
   if(step.error)throw step.error;
   steps++;
  }catch{
   await admin.from('v2_branch_jobs').update({updated_at:new Date().toISOString(),retry_after:new Date(Date.now()+60000).toISOString(),error_code:'COPY_RETRY'}).eq('id',job.id).eq('status','pending');
  }
 }
 return steps;
}
export async function assertBranchDowngrade(admin:Admin,rootId:string,capacity:number){
 const b=await admin.from('v2_branches').select('restaurant_id',{count:'exact',head:true}).eq('root_id',rootId).neq('status','archived');
 if(b.error)throw new BillingError('No se pudo comprobar el paquete de sucursales.',503);
 if((b.count||0)+1>capacity)throw new BillingError('Archive primero las sucursales que quedarán fuera del paquete. Sus registros se conservarán para consulta.',409,'BRANCH_ARCHIVE_FIRST');
}
