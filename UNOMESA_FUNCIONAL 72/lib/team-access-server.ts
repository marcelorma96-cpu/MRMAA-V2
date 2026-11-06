import { createHash, randomUUID } from 'node:crypto';
import { type SupabaseClient } from '@supabase/supabase-js';
import { siteOrigin } from './site-origin';
import { emailLanguage, isEmailLanguage } from './email-language';

export type TeamContext = {admin:SupabaseClient; member:{restaurant_id:string}; user:{id:string}};
export type TeamChange = {id:string;selected:boolean;role?:string;expected?:{role:string;status:string}|null};
const roles=['administrador','gerente','operacion','lectura'];
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function teamError(error:any):Error {
 const message=String(error?.message||error||'');
 const known:Record<string,string>={
  TEAM_ACCESS:'Solo el administrador principal puede asignar otras sucursales de esta empresa.',
  TEAM_MEMBER:'Este usuario ya no pertenece a la sucursal. Actualice la lista.',
  TEAM_SELECTION:'Seleccione al menos una sucursal y un rol válido. Puede guardar hasta 500 cambios por vez.',
  TEAM_READ_ONLY:'Una sucursal seleccionada está archivada o en modo de consulta. Active su acceso antes de asignar usuarios.',
  TEAM_CHANGED:'Los permisos cambiaron mientras editaba. Cierre y vuelva a abrir la edición para revisarlos.',
  TEAM_OWNER:'Los accesos del administrador principal se gestionan mediante Transferir administración.',
  TEAM_SELF:'No puede quitar ni cambiar su propio acceso desde esta pantalla.',
  TEAM_LAST_LOCATION:'Para retirar el último acceso, cierre la edición y use Eliminar en la lista de usuarios.',
  TEAM_LAST_ADMIN:'Debe quedar al menos un administrador activo en cada sucursal.',
  TEAM_ROLE:'Seleccione un rol válido para cada sucursal.',
  TEAM_EXISTS:'El usuario ya tiene acceso a una sucursal seleccionada. Use Editar para cambiar sus permisos.',
  TEAM_INACTIVE:'Reactive el acceso del usuario antes de asignarle otras sucursales.',
  TEAM_INVITATION:'El enlace ya venció o fue utilizado. Solicite una invitación nueva.',
  TEAM_RESEND_WAIT:'Espere 60 segundos antes de reenviar la invitación.',
 };
 if(/PGRST202|v2_team_.*does not exist|Could not find the function/i.test(message)||error?.code==='PGRST202')return new Error('Falta aplicar 58_USUARIOS_SUCURSALES.sql para configurar estos accesos.');
 if(message.includes('TEAM_CAPACITY'))return new Error('Se alcanzó el límite de usuarios en '+(message.split('TEAM_CAPACITY:')[1]?.trim()||'una sucursal seleccionada')+'. Revise su equipo o plan.');
 for(const [code,text] of Object.entries(known))if(message.includes(code))return new Error(text);
 return error instanceof Error?error:new Error(message||'No se pudieron guardar los permisos.');
}
export function teamChanges(value:unknown, invite=false):TeamChange[]{
 if(!Array.isArray(value)||value.length>500||(invite&&!value.length))throw teamError('TEAM_SELECTION');
 const ids=new Set<string>();
 return value.map(x=>{
  if(!x||typeof x.id!=='string'||!/^\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b$/i.test(x.id)||ids.has(x.id)||typeof x.selected!=='boolean'||(invite&&!x.selected)||(x.selected&&!roles.includes(x.role)))throw teamError('TEAM_SELECTION');
  ids.add(x.id);
  return {id:x.id,selected:x.selected,role:x.role,...(Object.hasOwn(x,'expected')?{expected:x.expected}: {})};
 });
}
export async function teamRpc(admin:SupabaseClient,name:string,args:Record<string,unknown>){const result=await admin.rpc(name,args);if(result.error)throw teamError(result.error);return result.data;}
export async function teamCatalog(ctx:TeamContext,params:URLSearchParams){
 const id=params.get('user');if(id&&!/^[0-9a-f-]{36}$/i.test(id))throw teamError('TEAM_MEMBER');
 return teamRpc(ctx.admin,'v2_team_catalog',{p_context:ctx.member.restaurant_id,p_actor:ctx.user.id,p_user:id||null,p_search:(params.get('search')||'').slice(0,100),p_after_name:params.get('after_name'),p_after_id:params.get('after_id')});
}
const labels:Record<string,Record<string,string>>={es:{administrador:'Administrador',gerente:'Gerente',operacion:'Operación',lectura:'Solo lectura'},en:{administrador:'Administrator',gerente:'Manager',operacion:'Operations',lectura:'Read only'}};
function invitationMetadata(info:any,language:string,name:string,restaurantId:string){
 const l=labels[language]||labels.es;
 return {full_name:name,restaurant_id:restaurantId,role:info.branches?.find((b:any)=>b.id===restaurantId)?.role||"operacion",language,company_name:info.company,
  branch_access_summary:(info.branches||[]).map((b:any)=>`${b.name} (${l[b.role]||b.role})`).join(' · ')};
}
export async function inviteTeam(ctx:TeamContext,body:any,origin:string){
 const {admin,member,user}=ctx;
 const name=String(body.name||'').trim().slice(0,120),email=String(body.email||'').trim().toLowerCase();
 if(!name||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Nombre y correo válidos son obligatorios.');
 if(!isEmailLanguage(body.language))throw new Error('El idioma seleccionado no es válido.');
 const changes=teamChanges(body.branches,true);
 // All branches are checked before sending any mail, and again atomically when saving.
 const info=await teamRpc(admin,'v2_team_invite_check',{p_context:member.restaurant_id,p_actor:user.id,p_email:email,p_changes:changes});
 const token=randomUUID(),tokenHash=hash(token);
 const primary=changes.some(x=>x.id===member.restaurant_id)?member.restaurant_id:changes[0].id;
 const metadata=invitationMetadata(info,body.language,name,primary);
 const redirectTo=`${siteOrigin(origin)}/?invite=1&invitation=${encodeURIComponent(token)}`;
 let userId=info.user_id as string|null,created=false;
 if(!userId){
  const response=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:metadata});
  if(response.error){
   if(/already been registered|already registered|already exists/i.test(response.error.message))throw new Error('No se puede asignar este correo desde esta empresa. Use un usuario de su equipo o un correo nuevo.');
   throw response.error;
  }
  if(!response.data.user)throw new Error('No se pudo crear la invitación.');
  userId=response.data.user.id;created=true;
 }
 try{
  const result=await teamRpc(admin,'v2_team_apply',{p_context:member.restaurant_id,p_actor:user.id,p_user:userId,p_name:name,p_email:email,p_changes:changes,p_mode:'invite',p_hash:tokenHash});
  if(!created&&!result.linked){
   const preference=await admin.auth.admin.updateUserById(userId!,{user_metadata:metadata});
   if(preference.error)throw preference.error;
   const sent=await admin.auth.resetPasswordForEmail(email,{redirectTo});
   if(sent.error)throw new Error('Los accesos quedaron pendientes, pero no se pudo enviar el correo. Use Reenviar invitación.');
  }
  return {...result,existingUser:!created,email};
 }catch(error){
  if(created){
   const links=await admin.from('v2_members').select('user_id',{count:'exact',head:true}).eq('user_id',userId);
   if(!links.error&&links.count===0)await admin.auth.admin.deleteUser(userId!);
  }
  throw error;
 }
}
export async function editTeam(ctx:TeamContext,body:any){
 const changes=teamChanges(body.branches),name=String(body.name||'').trim().slice(0,120);
 if(!name)throw new Error('El nombre es obligatorio.');
 if(body.language!==undefined&&!isEmailLanguage(body.language))throw new Error('El idioma seleccionado no es válido.');
 const result=await teamRpc(ctx.admin,'v2_team_apply',{p_context:ctx.member.restaurant_id,p_actor:ctx.user.id,p_user:body.user_id,p_name:name,p_email:null,p_changes:changes,p_mode:'edit',p_hash:null});
 const preference=await ctx.admin.auth.admin.updateUserById(body.user_id,{user_metadata:{full_name:name,...(body.language!==undefined&&{language:body.language})}});
 if(preference.error)throw new Error('Se guardaron los permisos, pero no la preferencia de correo. Abra la edición nuevamente.');
 return result;
}
export async function resendTeam(ctx:TeamContext,userId:string,email:string,origin:string){
 const auth=await ctx.admin.auth.admin.getUserById(userId);
 if(auth.error||!auth.data.user)throw new Error('No se encontró el usuario de la invitación.');
 const token=randomUUID();
 const info=await teamRpc(ctx.admin,'v2_team_resend',{p_context:ctx.member.restaurant_id,p_actor:ctx.user.id,p_user:userId,p_hash:hash(token)});
 const metadata=invitationMetadata(info,emailLanguage(auth.data.user.user_metadata?.language),String(auth.data.user.user_metadata?.full_name||''),ctx.member.restaurant_id);
 const pref=await ctx.admin.auth.admin.updateUserById(userId,{user_metadata:metadata});if(pref.error)throw pref.error;
 const result=await ctx.admin.auth.resetPasswordForEmail(email,{redirectTo:`${siteOrigin(origin)}/?invite=1&invitation=${encodeURIComponent(token)}`});
 if(result.error)throw new Error('No se pudo enviar el correo. Espere un minuto y use Reenviar invitación.');
 return {ok:true};
}
