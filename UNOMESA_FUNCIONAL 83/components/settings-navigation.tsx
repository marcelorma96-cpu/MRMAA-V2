"use client";
import {useState} from 'react';
import {Building2,Globe,CalendarDays,FileText,Clock3,Users,KeyRound,UserRound,CreditCard,ShieldCheck,LifeBuoy,ChevronRight,Check,Settings2} from 'lucide-react';
import {AppSheet,useAppMode} from './app-context';

const sections = {
 general: {label:['General','General'], description:['Identidad y preferencias','Identity and preferences'], icon:Building2},
 publica: {label:['Página pública','Public page'], description:['Su restaurante en línea','Your restaurant online'], icon:Globe},
 reservaciones: {label:['Reservaciones','Reservations'], description:['Áreas, mesas y preferencias','Rooms, tables and preferences'], icon:CalendarDays},
 cotizaciones: {label:['Cotizaciones','Quotes'], description:['Productos y documentos','Products and documents'], icon:FileText},
 horarios: {label:['Horarios','Schedules'], description:['Turnos y equipo','Shifts and team'], icon:Clock3},
 usuarios: {label:['Usuarios','Users'], description:['Personas y permisos','People and permissions'], icon:Users},
 'verificación en dos pasos': {label:['Verificación en dos pasos','Two-step verification'], description:['Proteja su inicio de sesión','Protect your sign-in'], icon:KeyRound},
 seguridad: {label:['Seguridad','Security'], description:['Controle el acceso','Manage access'], icon:ShieldCheck},
 cuenta: {label:['Cuenta','Account'], description:['Su perfil y preferencias','Your profile and preferences'], icon:UserRound},
 suscripción: {label:['Suscripción','Subscription'], description:['Plan y facturación','Plan and billing'], icon:CreditCard},
 soporte: {label:['Soporte','Support'], description:['Ayuda con su cuenta','Help with your account'], icon:LifeBuoy},
};
const groups = [
 {label:['Restaurante','Restaurant'],keys:['general','publica','reservaciones','cotizaciones','horarios']},
 {label:['Equipo y acceso','Team & access'],keys:['usuarios','verificación en dos pasos','seguridad']},
 {label:['Cuenta y ayuda','Account & help'],keys:['cuenta','suscripción','soporte']},
];
type Props={language:string;active:string;tabs:string[];onSelect:(key:string)=>boolean};
/** Permission-filtered navigation. A cancelled draft confirmation keeps the panel open. */
export function SettingsChoices({language,active,tabs,onSelect}:Props){
 const i=language==='en'?1:0;
 return <aside className="settingsNavigation" aria-label={i?'Settings sections':'Secciones de configuración'} translate="no">
  <div className="settingsNavIntro"><span className="settingsNavEmblem" aria-hidden="true"><Settings2 size={24}/></span><div><span>{i?'YOUR WORKSPACE':'SU ESPACIO'}</span><h3>{i?'Make it yours':'A su manera'}</h3><p>{i?'Everything you need to manage your restaurant.':'Todo para organizar su restaurante.'}</p></div></div>
  {groups.map(group=>{const visible=group.keys.filter(key=>tabs.includes(key));return visible.length>0&&<section className="settingsNavGroup" key={group.keys[0]}><h3>{group.label[i]}</h3><div>{visible.map(key=>{
   const item=sections[key as keyof typeof sections],Icon=item.icon,selected=active===key;
   return <button type="button" className={selected?'active':''} aria-current={selected?'page':undefined} onClick={()=>onSelect(key)} key={key}>
    <span className="settingsChoiceIcon" aria-hidden="true"><Icon size={21}/></span><span className="settingsChoiceText"><strong>{item.label[i]}</strong><small>{item.description[i]}</small></span><span className="settingsChoiceArrow" aria-hidden="true">{selected?<Check size={17}/>:<ChevronRight size={17}/>}</span>
   </button>;
  })}</div></section>})}
 </aside>;
}
export function SettingsNavigation(props:Props){
 const app=useAppMode(),[open,setOpen]=useState(false),en=props.language==='en';
 const current=sections[props.active as keyof typeof sections];
 if(!app)return <SettingsChoices {...props}/>;
 return <><button type="button" className="settingsMenuTrigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)} translate="no"><span className="settingsMenuIcon" aria-hidden="true"><Settings2 size={23}/></span><span><strong>{en?'Settings sections':'Opciones de configuración'}</strong><small>{current?.label[en?1:0]||props.active}</small></span><ChevronRight size={20} aria-hidden="true"/></button>
  <AppSheet open={open} title={en?'Settings':'Configuración'} close={()=>setOpen(false)}><SettingsChoices {...props} onSelect={key=>{const accepted=props.onSelect(key);if(accepted)setOpen(false);return accepted}}/></AppSheet>
 </>;
}
