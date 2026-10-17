"use client";
import {Children,useContext,useState,type ReactNode} from 'react';
import {MoreHorizontal,ChevronDown} from 'lucide-react';
import {FloorTouchContext} from './floor-touch';

export function FloorActionMenu({children,label}:{children:ReactNode;label?:string}){
 const {en}=useContext(FloorTouchContext);
 if(!Children.toArray(children).length)return null;
 return <details className="floorActionMenu" onClick={e=>{if((e.target as Element).closest('button'))e.currentTarget.open=false}}><summary aria-label={label|| (en?'More actions':'Más acciones')}><MoreHorizontal size={20}/><span>{label||(en?'More':'Más')}</span></summary><div className="floorActionChoices">{children}</div></details>;
}
export function FloorReservationActions({onEdit,onDelete,onViewQuote,onCreateQuote,onLinkQuote,disabled=false}:{onEdit?:()=>void;onDelete?:()=>void;onViewQuote?:()=>void;onCreateQuote?:()=>void;onLinkQuote?:()=>void;disabled?:boolean}){
 const {en}=useContext(FloorTouchContext),say=(es:string,english:string)=>en?english:es;
 return <div className="floorQuickActions">{onEdit&&<button type="button" className="secondary" disabled={disabled} onClick={onEdit}>{say('Editar reserva','Edit reservation')}</button>}<FloorActionMenu>
 {onViewQuote&&<button type="button" disabled={disabled} onClick={onViewQuote}>{say('Ver cotización','View quote')}</button>}
 {onCreateQuote&&<button type="button" disabled={disabled} onClick={onCreateQuote}>{say('Crear cotización','Create quote')}</button>}
 {onLinkQuote&&<button type="button" disabled={disabled} onClick={onLinkQuote}>{say('Vincular cotización','Link quote')}</button>}
 {onDelete&&<button type="button" className="danger" disabled={disabled} onClick={onDelete}>{say('Eliminar reserva','Delete reservation')}</button>}
 </FloorActionMenu></div>;
}
export function FloorContextBooking({summary,children}:{summary:ReactNode;children:ReactNode}){
 const {enabled}=useContext(FloorTouchContext),[open,setOpen]=useState(false);
 if(!enabled)return <>{summary}{children}</>;
 return <><button type="button" className="floorContextBooking" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{summary}<ChevronDown size={16}/></button>{open&&<div className="floorContextBookingDetails">{children}</div>}</>;
}
