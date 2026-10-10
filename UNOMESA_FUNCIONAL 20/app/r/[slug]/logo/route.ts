import {NextRequest} from 'next/server';
import {publicAdmin} from '@/lib/public-server';
import {validSlug} from '@/lib/restaurant-public';
import {publicLogoSource,logoMime,maximumLogoBytes} from '@/lib/public-logo';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'};
const unavailable=(status=404)=>new Response(null,{status,headers});
export async function GET(_request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;if(!validSlug(slug))return unavailable();
 try{
  const admin=publicAdmin();
  const page=await admin.from('v2_public_pages').select('restaurant_id,content').eq('slug',slug).eq('published',true).maybeSingle();
  if(page.error)return unavailable(503);if(!page.data)return unavailable();
  const restaurant=page.data.restaurant_id;
  const general=await admin.from('v2_restaurants').select('settings').eq('id',restaurant).maybeSingle();
  if(general.error)return unavailable(503);if(!general.data)return unavailable();
  const source=publicLogoSource(general.data.settings,page.data.content?.logo||'',restaurant,process.env.NEXT_PUBLIC_SUPABASE_URL||'');
  if(!source)return unavailable();
  let bytes:Uint8Array;
  if(source.startsWith('data:'))bytes=Buffer.from(source.slice(source.indexOf(',')+1),'base64');
  else{
   const result=await fetch(source,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
   if(!result.ok||!result.body||Number(result.headers.get('content-length'))>maximumLogoBytes){await result.body?.cancel();return unavailable(502)}
   const reader=result.body.getReader(),chunks:Uint8Array[]=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maximumLogoBytes){await reader.cancel();return unavailable(502)}chunks.push(value)}}finally{reader.releaseLock()}
   bytes=Buffer.concat(chunks);
  }
  const mime=logoMime(bytes);if(!mime||bytes.length>maximumLogoBytes)return unavailable(502);
  return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':mime,'Content-Length':String(bytes.length)}});
 }catch{return unavailable(503)}
}
