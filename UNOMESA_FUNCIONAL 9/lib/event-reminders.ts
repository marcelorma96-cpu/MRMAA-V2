import type {SupabaseClient} from '@supabase/supabase-js';
import type {EventFollowup,EventInbox,EventTarget,EventTask} from './event-followup';

export const REMINDER_VISIBLE_PAGE_SIZE=5;
export const REMINDER_FETCH_SIZE=50; // Existing RPC's bounded page; reused for ten visible pages.
export type ReminderInbox=EventInbox & {quoteNumbers:Record<string,number>};
export async function readEventPending(client:SupabaseClient,restaurant:string,target:EventTarget,signal?:AbortSignal):Promise<EventFollowup>{
 signal?.throwIfAborted();
 let query=client.rpc('v2_event_read',{p_restaurant_id:restaurant,p_kind:target.kind,p_id:target.id});
 if(signal)query=query.abortSignal(signal);
 const result=await query;signal?.throwIfAborted();
 if(result.error)throw result.error;
 if(!result.data?.event||!Array.isArray(result.data.tasks))throw new Error('EVENT_RESPONSE');
 return result.data;
}
export async function readReminderInbox(client:SupabaseClient,restaurant:string,offset:number,signal:AbortSignal):Promise<ReminderInbox>{
 signal.throwIfAborted();
 const result=await client.rpc('v2_event_inbox',{p_restaurant_id:restaurant,p_offset:offset}).abortSignal(signal);
 signal.throwIfAborted();if(result.error)throw result.error;
 const data=result.data as EventInbox;
 if(!data||!Array.isArray(data.rows)||!Number.isSafeInteger(data.total)||data.total<0)throw new Error('EVENT_RESPONSE');
 const ids=[...new Set(data.rows.filter(x=>x.kind==='quote').map(x=>x.event_id))];
 const quoteNumbers:Record<string,number>={};
 if(ids.length){
  const quotes=await client.from('v2_quotes').select('id,quote_number').eq('restaurant_id',restaurant).is('deleted_at',null).in('id',ids).abortSignal(signal);
  signal.throwIfAborted();if(quotes.error)throw quotes.error;
  for(const quote of quotes.data||[])quoteNumbers[quote.id]=quote.quote_number;
 }
 return {...data,quoteNumbers};
}
export type PendingDraft=Pick<EventTask,'id'|'title'|'status'|'category'|'assignee'|'due_date'|'notes'|'revision'>;
export function pendingDraft(task?:EventTask):PendingDraft{
 return task?{id:task.id,title:task.title,status:task.status,category:task.category,assignee:task.assignee,due_date:task.due_date,notes:task.notes,revision:task.revision}
 :{id:crypto.randomUUID(),title:'',status:'pending',category:'custom',assignee:'',due_date:null,notes:'',revision:0};
}
/** Edits change only the entered title. Legacy owner/date/notes/status survive unchanged. */
export async function saveEventPending(client:SupabaseClient,restaurant:string,target:EventTarget,draft:PendingDraft){
 const title=draft.title.trim();if(!title||title.length>160)throw new Error('EVENT_INPUT');
 const result=await client.rpc('v2_event_save_task',{p_restaurant_id:restaurant,p_kind:target.kind,p_id:target.id,p_task_id:draft.id,p_revision:draft.revision,p_payload:{...draft,title}});
 if(result.error)throw result.error;
 return result.data as EventTask;
}
/** Dismiss for the team, preserving the task and the source quote/reservation. */
export async function dismissEventPending(client:SupabaseClient,restaurant:string,target:EventTarget,id:string,expectedUpdatedAt?:string){
 const context=await readEventPending(client,restaurant,target),task=context.tasks.find(x=>x.id===id);
 if(!task)throw new Error('EVENT_NOT_FOUND');
 if(!['pending','waiting'].includes(task.status))return task;
 if(expectedUpdatedAt&&task.updated_at!==expectedUpdatedAt)throw new Error('EVENT_STALE');
 return saveEventPending(client,restaurant,target,{...pendingDraft(task),status:'not_needed'});
}
