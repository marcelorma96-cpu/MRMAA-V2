import type {SupabaseClient} from '@supabase/supabase-js';
import type {ListCursor,ListPage} from './cursor-pagination';
import type {QuoteSummary} from './quote-data';
import {floorError,missingFloorFunction} from './floor-plan';
import {userMessage} from './user-message';
export async function readLinkableQuotePage(client:SupabaseClient,restaurant:string,search:string,after:ListCursor|null,signal:AbortSignal):Promise<ListPage<QuoteSummary>> {
 signal.throwIfAborted();
 const result=await client.rpc('v2_linkable_quote_page',{p_restaurant:restaurant,p_search:search,p_after:after}).abortSignal(signal);
 signal.throwIfAborted();
 if(result.error)throw result.error;
 if(!Array.isArray(result.data?.rows))throw new Error('EVENT_LINK_READ');
 return result.data;
}
export function eventLinkError(error:unknown,en:boolean){
 const detail=error as {code?:string;message?:string}|null|undefined;
 if(missingFloorFunction(detail,'v2_link_existing_events')||missingFloorFunction(detail,'v2_linkable_quote_page'))return en?'Apply SQL 60 to enable linking for all event statuses. Your records have not changed.':'Aplique el SQL 60 para habilitar la vinculación de todos los estados. Sus registros no han cambiado.';
 const message=String((error as any)?.message||error||'');
 const labels:Record<string,[string,string]>={
  EVENT_LINK_RESERVATION_USED:['Esta reservación ya tiene una cotización. Actualice el listado.','This reservation already has a quote. Refresh the list.'],
  EVENT_LINK_QUOTE_USED:['Esta cotización ya tiene una reservación vinculada, incluso en la papelera. Elija otra.','This quote already has a linked reservation, possibly in trash. Choose another.'],
  EVENT_LINK_RESERVATION:['La reservación ya no está disponible en esta sucursal. Actualice el listado.','The reservation is no longer available in this branch. Refresh the list.'],
  EVENT_LINK_QUOTE:['La cotización ya no está disponible en esta sucursal. Actualice el listado.','The quote is no longer available in this branch. Refresh the list.'],
  EVENT_LINK_CLIENT:['Revise el cliente de la cotización: ya no está disponible en esta sucursal.','Review the quote customer: they are no longer available in this branch.'],
  EVENT_LINK_AREA:['Revise el área de la cotización: ya no está disponible en esta sucursal.','Review the quote area: it is no longer available in this branch.'],
  EVENT_LINK_READ:['No se pudo cargar el listado. Intente nuevamente.','Could not load the list. Try again.'],
  EVENT_LINK_INPUT:['Actualice el listado e intente nuevamente.','Refresh the list and try again.'],
 };
 for(const [key,text] of Object.entries(labels))if(message.includes(key))return text[en?1:0];
 return message.includes('FLOOR_')?floorError(error,en):userMessage(error);
}
