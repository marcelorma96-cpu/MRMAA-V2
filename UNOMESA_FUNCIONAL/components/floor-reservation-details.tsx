"use client";
import {reservationMenuLabel} from '@/lib/reservation-menu-label';

import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {formatAppMoney} from './app-preferences';
import {translate} from '@/lib/translations';
import type {FloorReservation} from '@/lib/floor-plan';
const paymentMethodLabel=(value?:string|null)=>({efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia',deposito:'Depósito',otro:'Otro'}[value||'']||value||'—');
function LoadedFloorReservationDetails({restaurantId,reservation,demo,en,preferences,refreshToken}:{restaurantId:string;reservation:FloorReservation;demo:boolean;en:boolean;preferences:Record<string,any>;refreshToken:number}){
 const [detail,setDetail]=useState<any>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError(false);
  if(demo){setDetail(reservation);return;}
  (async()=>{const result=await supabase.from('v2_reservations').select('id,phone,menu,deposit,payment_method,notes,status,quote_id').eq('restaurant_id',restaurantId).eq('id',reservation.id).is('deleted_at',null).abortSignal(controller.signal).single();if(controller.signal.aborted)return;if(result.error)throw result.error;setDetail(result.data)})().catch(()=>{if(!controller.signal.aborted)setError(true)});
  return()=>controller.abort();
 },[restaurantId,reservation.id,demo,refreshToken,retry]);
 const current=detail?.id===reservation.id?detail:null,say=(es:string,eng:string)=>en?eng:es;
 return <div className="floorBookingDetails"><dl><div><dt>{say('Teléfono','Phone')}</dt><dd dir="ltr">{current?.phone||reservation.phone||say('Sin teléfono','No phone')}</dd></div><div><dt>{say('Estado','Status')}</dt><dd>{translate(current?.status||reservation.status,en?'en':'es')}</dd></div>{current&&<><div><dt>{say('Menú','Menu')}</dt><dd>{reservationMenuLabel(current.menu)||'—'}</dd></div>{preferences.reservation_show_deposits_list!==false&&<><div><dt>{say('Anticipo','Deposit')}</dt><dd>{current.deposit==null?'—':formatAppMoney(Number(current.deposit))}</dd></div><div><dt>{say('Método de pago','Payment method')}</dt><dd>{translate(paymentMethodLabel(current.payment_method),en?'en':'es')}</dd></div></>}</>}</dl>{current?.notes&&<div className="floorBookingNotes"><b>{say('Observaciones','Notes')}</b><p>{current.notes}</p></div>}{!current&&!error&&<small role="status">{say('Cargando detalles…','Loading details…')}</small>}{error&&<p role="alert">{say('No se pudieron actualizar los detalles.','Could not refresh details.')} <button type="button" className="floorTextButton" onClick={()=>setRetry(v=>v+1)}>{say('Reintentar','Retry')}</button></p>}</div>;
}

export function FloorReservationDetails(props:Parameters<typeof LoadedFloorReservationDetails>[0]&{lazy?:boolean}){
 const [open,setOpen]=useState(false);
 return props.lazy?<details className="floorBookingDisclosure" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{props.en?'View full reservation details':'Ver datos completos de la reserva'}</summary>{open&&<LoadedFloorReservationDetails {...props}/>}</details>:<LoadedFloorReservationDetails {...props}/>;
}
