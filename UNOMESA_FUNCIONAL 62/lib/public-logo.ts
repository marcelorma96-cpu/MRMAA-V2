/** Only a published restaurant's existing branding may be returned by the logo endpoint. */
export const maximumLogoBytes=8*1024*1024;
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export function publicLogoSource(settings:Record<string,unknown>|null,legacy:string,restaurant:string,origin:string){
 if(!new RegExp('^'+uuid+'$','i').test(restaurant))return '';
 const hasGeneral=Object.prototype.hasOwnProperty.call(settings||{},'logo_data_url');
 const value=hasGeneral?settings?.logo_data_url:undefined;
 if(hasGeneral&&typeof value!=='string')return '';
 if(typeof value==='string'&&value.startsWith('data:')){
  return value.length<=Math.ceil(maximumLogoBytes*4/3)+80&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'';
 }
 try{
  const base=new URL(origin);if(!['https:','http:'].includes(base.protocol)||base.username||base.password)return '';
  if(hasGeneral){
   if(!value)return '';
   const url=new URL(value as string),prefix='/storage/v1/object/public/mrmaa-branding/'+restaurant+'/';
   if(url.origin!==base.origin||url.username||url.password||url.search||url.hash||!url.pathname.startsWith(prefix)||!/^[-a-zA-Z0-9_.]+\.(png|jpe?g|webp)$/.test(url.pathname.slice(prefix.length)))return '';
   return url.href;
  }
  // Compatibility only when General has never set a logo. Explicit removal stays empty.
  if(new RegExp('^'+restaurant+'/'+uuid+'\\.(png|jpg|jpeg|webp)$','i').test(legacy))return new URL('/storage/v1/object/public/unomesa-public/'+legacy,base).href;
 }catch{}
 return '';
}
export function logoMime(bytes:Uint8Array){
 const b=Buffer.from(bytes);
 if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>=12&&b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'image/webp';
 return '';
}
