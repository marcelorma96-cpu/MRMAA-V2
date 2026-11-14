import type {SupabaseClient} from '@supabase/supabase-js';
export type AreaInstruction={month:string;area:string;text:string};
export async function readScheduleAreaNotes(client:SupabaseClient,restaurant:string,from:string,to:string){
 const {data,error}=await client.rpc('v2_get_schedule_area_notes',{p_restaurant:restaurant,p_from:from,p_to:to});
 if(error)throw error;
 return (data??[]) as AreaInstruction[];
}
// Each printed table carries the instruction for its own month, including ranges across New Year.
export function scheduleDateBlocks(dates:string[],notes:AreaInstruction[]){
 const months=new Set(notes.map(n=>n.month)),blocks:string[][]=[];
 for(const date of dates){
  const last=blocks[blocks.length-1], m=date.slice(0,7),prev=last?.at(-1)?.slice(0,7);
  if(!last||last.length===14||(prev!==m&&(months.has(m)||months.has(prev!))))blocks.push([date]);
  else last.push(date);
 }
 return blocks;
}
