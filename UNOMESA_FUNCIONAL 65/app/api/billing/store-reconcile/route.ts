import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {serverClients} from '@/lib/billing-server';
import {reconcileStore} from '@/lib/store-billing-server';
import {storeEnabled,storeMode} from '@/lib/store-verification';
import {runStoreReconciliation} from '@/lib/store-reconcile-worker';
import type {StoreProvider} from '@/lib/store-catalog';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(req:NextRequest) {
 const expected=Buffer.from(process.env.CRON_SECRET||''),actual=Buffer.from(req.headers.get('authorization')?.replace(/^Bearer /,'')||'');
 if(!expected.length||expected.length!==actual.length||!timingSafeEqual(expected,actual))return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!storeEnabled('apple')&&!storeEnabled('google_play'))return NextResponse.json({checked:0,disabled:true});
 try {
  const {admin}=serverClients();
  const stores=(['apple','google_play'] as StoreProvider[]).filter(storeEnabled).map(provider=>({provider,mode:storeMode(provider)}));
  const result=await runStoreReconciliation(admin,stores,reconcileStore,Date.now()+240000);
  return NextResponse.json(result,{status:result.failed||result.queue_failed?503:200,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Reconciliation unavailable'},{status:503});}
}
