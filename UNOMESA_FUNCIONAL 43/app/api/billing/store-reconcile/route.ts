import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {serverClients} from '@/lib/billing-server';
import {reconcileStore} from '@/lib/store-billing-server';
import {storeEnabled} from '@/lib/store-verification';
import type {StoreProvider} from '@/lib/store-catalog';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(req:NextRequest) {
 const expected=Buffer.from(process.env.CRON_SECRET||''),actual=Buffer.from(req.headers.get('authorization')?.replace(/^Bearer /,'')||'');
 if(!expected.length||expected.length!==actual.length||!timingSafeEqual(expected,actual))return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!storeEnabled('apple')&&!storeEnabled('google_play'))return NextResponse.json({checked:0,disabled:true});
 const {admin}=serverClients();const due=await admin.from('v2_store_purchases').select('provider,mode,restaurant_id,external_id,purchase_reference').or('is_ended.eq.false,verified_until.gt.'+new Date(Date.now()-60*86400000).toISOString()).lt('checked_at',new Date(Date.now()-6*3600000).toISOString()).order('checked_at').limit(100);
 if(due.error)return NextResponse.json({error:'Reconciliation unavailable'},{status:503});
 let checked=0,failed=0;const deadline=Date.now()+240000;
 for(const row of due.data||[]) {
  if(Date.now()>deadline)break;
  try{if(storeEnabled(row.provider as StoreProvider)){await reconcileStore(admin,row.restaurant_id,row.provider as StoreProvider,row.purchase_reference);checked++;}}catch{failed++;}
  // Advance the retry queue even after transient failure; never alter access on
  // verification failure. Webhooks and owner refresh can retry independently.
  await admin.from('v2_store_purchases').update({checked_at:new Date().toISOString()}).eq('provider',row.provider).eq('mode',row.mode).eq('external_id',row.external_id);
 }
 return NextResponse.json({checked,failed},{status:failed?503:200,headers:{'Cache-Control':'no-store'}});
}
