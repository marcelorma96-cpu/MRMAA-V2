import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {serverClients} from '@/lib/billing-server';
import {runBranchJobs,runBranchTrash} from '@/lib/branch-server';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(req:NextRequest){
 const expected=Buffer.from(process.env.CRON_SECRET||''),actual=Buffer.from(req.headers.get('authorization')?.replace(/^Bearer /,'')||'');
 if(!expected.length||expected.length!==actual.length||!timingSafeEqual(expected,actual))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const {admin}=serverClients(),deadline=Date.now()+35000;let steps=0;
  for(let i=0;i<8&&Date.now()<deadline;i++){const n=await runBranchJobs(admin,deadline);steps+=n;if(!n)break;}
  const trash=await runBranchTrash(admin,Date.now()+15000);
  return NextResponse.json({steps,trash},{status:trash.failed?503:200,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Branch setup will retry.'},{status:503});}
}
