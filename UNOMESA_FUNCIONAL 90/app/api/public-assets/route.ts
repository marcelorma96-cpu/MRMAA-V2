import { NextRequest,NextResponse } from 'next/server';
import { publicManager } from '@/lib/public-server';
import { RequestSafetyError,takeDistributedRateLimit } from '@/lib/server-scale';
export async function POST(req:NextRequest){let reserved:string|undefined,admin:ReturnType<typeof import('@/lib/public-server').publicAdmin>|undefined;try{
 const restaurant=req.nextUrl.searchParams.get('restaurant')||'';const ctx=await publicManager(req,restaurant);admin=ctx.admin;
 await takeDistributedRateLimit(admin,req,'public-assets:upload',20,300);
 const max=3*1024*1024;if(Number(req.headers.get('content-length'))>max||!req.body)throw new RequestSafetyError('PUBLIC_SIZE',413);
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new RequestSafetyError('PUBLIC_SIZE',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=Buffer.concat(chunks),mime=req.headers.get('content-type');let ext='';
 if(mime==='application/pdf'&&bytes.subarray(0,5).toString()==='%PDF-')ext='pdf';
 if(mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';
 if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';
 if(mime==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')ext='webp';
 if(!ext)throw new RequestSafetyError('PUBLIC_TYPE',415);
 const id=crypto.randomUUID(),name=(req.nextUrl.searchParams.get('name')||`menu.${ext}`).slice(0,100);
 const reserve=await ctx.client.rpc('v2_public_asset_reserve',{p_restaurant:restaurant,p_id:id,p_extension:ext,p_name:name,p_size:size});if(reserve.error)throw new RequestSafetyError(/PUBLIC_QUOTA/.test(reserve.error.message)?'PUBLIC_QUOTA':'PUBLIC_ACCESS',400);reserved=id;
 const result=await admin.storage.from('unomesa-public').upload(reserve.data,bytes,{contentType:mime!,upsert:false,cacheControl:'3600'});if(result.error)throw new Error('UPLOAD');
 const ready=await admin.from('v2_public_assets').update({ready:true}).eq('id',id).select('id,path,name,size,ready').single();if(ready.error)throw new Error('UPLOAD');reserved=undefined;
 return NextResponse.json(ready.data,{headers:{'Cache-Control':'no-store'}});
}catch(e){if(reserved&&admin){const r=await admin.from('v2_public_assets').select('path').eq('id',reserved).maybeSingle();if(r.data){const removed=await admin.storage.from('unomesa-public').remove([r.data.path]);if(!removed.error)await admin.from('v2_public_assets').delete().eq('id',reserved);}}
 return NextResponse.json({error:e instanceof RequestSafetyError?e.message:'SERVICE_UNAVAILABLE'},{status:e instanceof RequestSafetyError?e.status:503});}}
export async function DELETE(req:NextRequest){try{const restaurant=req.nextUrl.searchParams.get('restaurant')||'',id=req.nextUrl.searchParams.get('id')||'';const {client,admin}=await publicManager(req,restaurant);const locked=await client.rpc('v2_public_asset_detach',{p_restaurant:restaurant,p_id:id});if(locked.error)throw new RequestSafetyError('PUBLIC_IN_USE',409);const deleted=await admin.storage.from('unomesa-public').remove([locked.data]);if(deleted.error)throw new Error();await admin.from('v2_public_assets').delete().eq('restaurant_id',restaurant).eq('id',id);return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof RequestSafetyError?e.message:'SERVICE_UNAVAILABLE'},{status:e instanceof RequestSafetyError?e.status:503});}}
