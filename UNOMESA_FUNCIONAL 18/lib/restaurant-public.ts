import { whatsappNumber, officialWhatsAppLink } from './public-contact';
export type Channel='whatsapp'|'email'|'phone';
export type PublicCard={id:string;source_id?:string;name:string;description:string;price:string;category:string;image:string;capacity:string};
export type PublicContent={name:string;description:string;address:string;logo:string;cover:string;language:'es'|'en';currency:string;whatsapp:string;whatsapp_link?:string;email:string;phone:string;channels:Channel[];quotes:boolean;reservations:boolean;consultations:boolean;menus:PublicCard[];areas:PublicCard[];pdfs:{name:string;path:string}[]};
export const emptyPublicContent=(name=''):PublicContent=>({name,description:'',address:'',logo:'',cover:'',language:'es',currency:'USD',whatsapp:'',whatsapp_link:'',email:'',phone:'',channels:[],quotes:true,reservations:true,consultations:true,menus:[],areas:[],pdfs:[]});
export const slugFor=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64);
export const validSlug=(s:string)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length>=3&&s.length<=64;
export const phoneDigits=(s:string)=>s.replace(/[+\s().-]/g,'');
export const validPhone=(s:string)=>/^[1-9]\d{7,14}$/.test(phoneDigits(s));
export function contactLink(channel:Channel,content:Pick<PublicContent,'whatsapp'|'email'|'phone'|'whatsapp_link'>,text=''){
 if(channel==='whatsapp'){if(content.whatsapp_link?.trim())return officialWhatsAppLink(content.whatsapp_link);const number=whatsappNumber(content.whatsapp);return number?`https://wa.me/${number}?text=${encodeURIComponent(text)}`:'';}
 if(channel==='phone')return validPhone(content.phone)?`tel:+${phoneDigits(content.phone)}`:'';
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email)?`mailto:${encodeURIComponent(content.email).replace(/%40/g,'@')}?subject=${encodeURIComponent('Consulta / Inquiry')}&body=${encodeURIComponent(text)}`:'';
}
export function publicPdfUrl(path:string,name='menu'){
 const match=/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.pdf$/.exec(path);
 return match?`/menus/${match[1]}/${match[2]}/${slugFor(name.replace(/\.pdf$/i,''))||'menu'}.pdf`:'';
}
export function assetUrl(path:string){if(path.endsWith('.pdf'))return publicPdfUrl(path);return /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|jpg|png|webp)$/.test(path)?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/unomesa-public/${path}`:'';}
const str=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
export function cleanContent(input:any):PublicContent{
 const text=(key:string,max:number)=>str(input?.[key],max);
 const cards=(value:any):PublicCard[]=>Array.isArray(value)?value.slice(0,60).map((x:any)=>({id:str(x.id,80),source_id:str(x.source_id,36),name:str(x.name,160),description:str(x.description,1000),price:str(x.price,50),category:str(x.category,80),image:str(x.image,100),capacity:str(x.capacity,50)})).filter(x=>x.name):[];
 return {name:text('name',160),description:text('description',1500),address:text('address',300),logo:text('logo',100),cover:text('cover',100),language:input?.language==='en'?'en':'es',currency:text('currency',10)||'USD',whatsapp:whatsappNumber(text('whatsapp',250))||phoneDigits(text('whatsapp',30)),whatsapp_link:officialWhatsAppLink(text('whatsapp_link',2048)),email:text('email',254),phone:phoneDigits(text('phone',30)),channels:[...new Set<Channel>((Array.isArray(input?.channels)?input.channels:[]).filter((x:any)=>['whatsapp','email','phone'].includes(x)))],quotes:input?.quotes===true,reservations:input?.reservations===true,consultations:input?.consultations===true,menus:cards(input?.menus),areas:cards(input?.areas),pdfs:(Array.isArray(input?.pdfs)?input.pdfs:[]).slice(0,5).map((x:any)=>({name:str(x.name,100),path:str(x.path,100)}))};
}
export function publicProblem(error:any,en=false){const text=String(error?.message||error||'');if(/PUBLIC_STALE/.test(text))return en?'Changed on another device. Reload before editing.':'Cambió desde otro dispositivo. Recargue antes de editar.';if(/23505|PUBLIC_SLUG/.test(text))return en?'This link is already taken. Choose another.':'Ese enlace ya está ocupado. Elija otro.';if(/PUBLIC_QUOTA/.test(text))return en?'Storage limit reached (20 MB / 30 files). Remove unused files.':'Límite alcanzado (20 MB / 30 archivos). Quite archivos sin usar.';if(/PUBLIC_INPUT/.test(text))return en?'Check the required fields, contact methods and files.':'Revise los campos obligatorios, medios de contacto y archivos.';if(/PUBLIC_ACCESS/.test(text))return en?'Your account cannot perform this action.':'Su cuenta no puede realizar esta acción.';if(/PUBLIC_NOT_FOUND/.test(text))return en?'The request or page is no longer available.':'La solicitud o página ya no está disponible.';return en?'Could not complete. Check connection and that SQL 50 and 51 are installed.':'No se pudo completar. Revise la conexión y que SQL 50 y 51 estén instalados.';}

export function maximumGuests(value:string):number|null{const s=value.trim();return /^[1-9][0-9]{0,5}$/.test(s)&&Number(s)<=100000?Number(s):null;}
