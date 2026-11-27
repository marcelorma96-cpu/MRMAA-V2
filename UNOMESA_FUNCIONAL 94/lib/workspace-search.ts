import type {SupabaseClient} from '@supabase/supabase-js';

type Shared={id:string;client_name:string;event_date:string;event_time:string|null;area:string|null;guests:number|null;status:string;deposit:number|null};
export type SearchReservation=Shared&{quote_id:string|null;phone:string|null};
export type SearchQuote=Shared&{quote_number:number;client_phone:string|null};
export type SearchCustomer={id:string;name:string;phone:string|null;email:string|null};
export type WorkspaceMatch=
 | {kind:'reservation';r:SearchReservation;q:SearchQuote|null}
 | {kind:'quote';q:SearchQuote}
 | {kind:'customer';c:SearchCustomer};
const common='id,client_name,event_date,event_time,area,guests,status,deposit';
const fields={reservations:common+',phone,quote_id',quotes:common+',client_phone,quote_number',clients:'id,name,phone,email'};
const limit=8;
const normalize=(s:string)=>s.trim().slice(0,96);
export const searchReady=(s:string)=>normalize(s).length>=2 && /[\p{L}\d]/u.test(s);
const wildcard=(s:string)=>JSON.stringify('%'+s.replace(/[\\%_*]/g,c=>'\\'+c)+'%');
const numberOf=(term:string)=>/^#?\d{1,10}$/.test(term)&&Number(term.replace('#',''))<=2147483647?Number(term.replace('#','')):null;
export function globalFilter(kind:keyof typeof fields,term:string){
 const name=kind==='clients'?'name':'client_name',phone=kind==='quotes'?'client_phone':'phone';
 const hash=term.startsWith('#'),number=numberOf(term);
 if(hash)return kind==='quotes'&&number!==null?'quote_number.eq.'+number:'';
 const words=normalize(term).split(/\s+/).filter(Boolean);
 const predicates=[name+'.ilike.'+wildcard(words.join(' '))];
 if(/^[+\d\s().-]+$/.test(term)){
   const digits=term.replace(/\D/g,'');
   if(digits.length>=2)predicates.push(phone+'.ilike.'+JSON.stringify('%'+digits.split('').join('%')+'%'));
   if(kind==='quotes'&&number!==null)predicates.push('quote_number.eq.'+number);
 }
 return predicates.join(',');
}
export const matchKey=(m:WorkspaceMatch)=>m.kind+':'+(m.kind==='reservation'?m.r.id:m.kind==='quote'?m.q.id:m.c.id);
export async function readWorkspaceMatches(db:SupabaseClient,branch:string,raw:string,signal:AbortSignal){
 const term=normalize(raw);
 const none={rows:[] as WorkspaceMatch[],more:false};
 if(!branch||!searchReady(term))return none;
 signal.throwIfAborted();
 function base(k:keyof typeof fields){
  return db.from('v2_'+k).select(fields[k]).eq('restaurant_id',branch).is('deleted_at',null);
 }
 const digits=/^[+\d\s().-]+$/.test(term)?term.replace(/\D/g,''):'';
 async function search(k:keyof typeof fields){
  const filter=globalFilter(k,term);if(!filter)return {rows:[],more:false};
  // Follow a bounded page of candidates; a formatted number must still contain the
  // contiguous digits after punctuation is removed. Never search a different branch.
  const cap=digits?64:limit+1;
  const result=await base(k).or(filter).order(k==='clients'?'name':'event_date',{ascending:k==='clients'}).order('id').limit(cap).abortSignal(signal);
  if(result.error)throw result.error;
  const rawRows=(result.data||[]) as unknown as Record<string,any>[];
  const checked=digits?rawRows.filter(x=>String(x[k==='quotes'?'client_phone':'phone']||'').replace(/\D/g,'').includes(digits)||String(x[k==='clients'?'name':'client_name']||'').includes(term)||(k==='quotes'&&x.quote_number===numberOf(term))):rawRows;
  return {rows:checked.slice(0,limit),more:checked.length>limit||rawRows.length===cap};
 }
 const [a,b,c]=await Promise.all([search('reservations'),search('quotes'),search('clients')]);signal.throwIfAborted();
 const rs=new Map((a.rows as SearchReservation[]).map(r=>[r.id,r])),qs=new Map((b.rows as SearchQuote[]).map(q=>[q.id,q]));
 const missing=[...new Set([...rs.values()].map(r=>r.quote_id).filter((id):id is string=>!!id&&!qs.has(id)))];
 const qids=[...qs.keys()];
 async function linked(k:'reservations'|'quotes',field:string,ids:string[]){
   if(!ids.length)return [];
   const res=await base(k).in(field,ids).order('id').limit(25).abortSignal(signal);
   if(res.error)throw res.error;
   return res.data||[];
 }
 const [relatedReservations,relatedQuotes]=await Promise.all([linked('reservations','quote_id',qids),linked('quotes','id',missing)]);signal.throwIfAborted();
 for(const r of relatedReservations.slice(0,24) as unknown as SearchReservation[])rs.set(r.id,r);
 for(const q of relatedQuotes as unknown as SearchQuote[])qs.set(q.id,q);
 const seen=new Set<string>(),events:WorkspaceMatch[]=[];
 for(const r of rs.values()){const q=(r.quote_id&&qs.get(r.quote_id))||null;if(q)seen.add(q.id);events.push({kind:'reservation',r,q})}
 for(const q of qs.values())if(!seen.has(q.id))events.push({kind:'quote',q});
 const num=numberOf(term);
 events.sort((x,y)=>{const qNum=(m:WorkspaceMatch)=>m.kind!=='customer'&&num!==null&&m.q?.quote_number===num?1:0;
 const date=(m:WorkspaceMatch)=>m.kind==='reservation'?m.r.event_date:m.kind==='quote'?m.q.event_date:'';
 return qNum(y)-qNum(x)||date(y).localeCompare(date(x))||matchKey(x).localeCompare(matchKey(y))});
 return {rows:[...events,...(c.rows as SearchCustomer[]).map(c=>({kind:'customer' as const,c}))],more:a.more||b.more||c.more||relatedReservations.length>24};
}
