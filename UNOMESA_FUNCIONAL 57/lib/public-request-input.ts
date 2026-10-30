import { validPhone } from './restaurant-public';

export const publicRequestFields = ['name','phone','email','event_date','event_time','guests','menu','area','preference','notes'] as const;
export type PublicRequestField = typeof publicRequestFields[number];
export type PublicRequestData = { name:string; phone:string; email:string; event_date:string; event_time:string; guests:number; menu:string; area:string; preference:string; notes:string };
const fieldCodes: Record<string,PublicRequestField> = {PUBLIC_NAME:'name',PUBLIC_PHONE:'phone',PUBLIC_EMAIL:'email',PUBLIC_DATE:'event_date',PUBLIC_DATE_RANGE:'event_date',PUBLIC_TIME:'event_time',PUBLIC_GUESTS:'guests',PUBLIC_MENU:'menu',PUBLIC_AREA:'area',PUBLIC_PREFERENCE:'preference',PUBLIC_NOTES:'notes'};
export function publicRequestField(code:unknown) { return typeof code==='string' ? fieldCodes[code] : undefined; }
export function publicRequestDateBounds(now=new Date()) {
 const day=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 return {min:new Date(day-86400000).toISOString().slice(0,10),max:new Date(day+1826*86400000).toISOString().slice(0,10)};
}

/** The browser and API validate the same values. Never guess a date or country code. */
export function validatePublicRequest(input:Record<string,unknown>,now=new Date()): {data:PublicRequestData;error?:never}|{error:string;data?:never} {
 const text=(key:string)=>typeof input[key]==='string'?input[key] as string:'';
 const name=text('name').trim(),email=text('email').trim();
 const phone=text('phone').replace(/[+\s().\-\u200b-\u200f\u202a-\u202e\u2066-\u2069\u2010-\u2015]/g,'');
 const event_date=text('event_date'),time=text('event_time');
 const event_time=/^([01]\d|2[0-3]):[0-5]\d:00$/.test(time)?time.slice(0,5):time;
 const menu=text('menu'),area=text('area'),notes=text('notes'),preference=text('preference');
 if(!name||name.length>160)return {error:'PUBLIC_NAME'};
 if(!validPhone(phone))return {error:'PUBLIC_PHONE'};
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {error:'PUBLIC_EMAIL'};
 const parsedDate=new Date(event_date+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(event_date)||!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==event_date)return {error:'PUBLIC_DATE'};
 const bounds=publicRequestDateBounds(now);
 if(event_date<bounds.min||event_date>bounds.max)return {error:'PUBLIC_DATE_RANGE'};
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(event_time))return {error:'PUBLIC_TIME'};
 if(!['string','number'].includes(typeof input.guests)||!String(input.guests).trim()||!Number.isInteger(Number(input.guests))||Number(input.guests)<1||Number(input.guests)>100000)return {error:'PUBLIC_GUESTS'};
 if(!menu.trim()||menu.length>160)return {error:'PUBLIC_MENU'};
 if((input.area!=null&&typeof input.area!=='string')||area.length>160)return {error:'PUBLIC_AREA'};
 if(!['whatsapp','email','phone'].includes(preference))return {error:'PUBLIC_PREFERENCE'};
 if((input.notes!=null&&typeof input.notes!=='string')||notes.length>2000)return {error:'PUBLIC_NOTES'};
 return {data:{name,phone,email,event_date,event_time,guests:Number(input.guests),menu,area,notes,preference}};
}

/** Used only to explain a rejected submission, never to bypass database validation. */
export function publicCatalogIssue(data:PublicRequestData,content:any):string|undefined {
 if(!content||content.quotes!==true)return 'PUBLIC_NOT_FOUND';
 if(!Array.isArray(content.channels)||!content.channels.includes(data.preference))return 'PUBLIC_PREFERENCE';
 if(data.menu!=='advice'&&(!Array.isArray(content.menus)||!content.menus.some((x:any)=>x?.name===data.menu)))return 'PUBLIC_MENU';
 if(data.area&&(!Array.isArray(content.areas)||!content.areas.some((x:any)=>x?.name===data.area)))return 'PUBLIC_AREA';
}
