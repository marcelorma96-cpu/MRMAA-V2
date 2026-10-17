"use client";
import {useEffect,useRef,useState} from 'react';
import type {FloorConfirmationKind} from '@/lib/floor-conflict-confirmation';
import {Modal} from './dashboard-ui';
export function useFloorConflictConfirmation(en:boolean){
 const [open,setOpen]=useState<FloorConfirmationKind|null>(null),answer=useRef<((value:boolean)=>void)|null>(null);
 useEffect(()=>()=>{answer.current?.(false)},[]);
 const finish=(value:boolean)=>{const resolve=answer.current;answer.current=null;setOpen(null);resolve?.(value)};
 const confirm=(kind:FloorConfirmationKind='conflict')=>new Promise<boolean>(resolve=>{answer.current?.(false);answer.current=resolve;setOpen(kind)});
 const dialog=open?<Modal title={open==='capacity'?(en?'Added seats':'Asientos adicionales'):(en?'Tables already booked':'Mesas ya reservadas')} close={()=>finish(false)}><div className="floorConflictConfirmation" translate="no"><p>{open==='capacity'?(en?'The party exceeds the usual capacity of the selected tables. Confirm that additional seats will be provided for this reservation.':'El grupo supera la capacidad habitual de las mesas. Confirme que se agregarán asientos para esta reserva.'):en?'One or more selected tables already have a reservation during this time.':'Una o más mesas seleccionadas ya tienen una reservación durante este horario.'}</p><p>{open==='capacity'?(en?'The usual table capacity stays unchanged.':'La capacidad habitual de las mesas se conserva.'):en?'Save anyway keeps both reservations on the same tables. Existing reservations will not be removed or changed.':'Guardar de todos modos conserva ambas reservas en las mismas mesas. No se elimina ni modifica la reservación existente.'}</p><div className="actions"><button type="button" className="secondary" autoFocus onClick={()=>finish(false)}>{en?'Review':'Revisar'}</button><button type="button" className="primary" onClick={()=>finish(true)}>{open==='capacity'?(en?'Save with added seats':'Guardar con asientos adicionales'):(en?'Save anyway':'Guardar de todos modos')}</button></div></div></Modal>:null;
 return {confirm,dialog};
}
