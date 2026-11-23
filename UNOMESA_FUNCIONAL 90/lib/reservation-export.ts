import {exportBudget} from './export-limits';
import {isCancelledReservation} from './reservation-totals';

/** Filtering affects the document only. Scan every source page, even an all-canceled page. */
export async function readReservationExport<T extends {status?:string|null}>(readPage:(first:number,last:number)=>PromiseLike<{data:T[]|null;error:unknown}>,maxRows:number,excludeCancelled:boolean):Promise<T[]>{
 const budget=exportBudget(maxRows),output:T[]=[];
 for(let first=0;;first+=1000){
  const batch=await readPage(first,first+999);
  if(batch.error)throw batch.error;
  const rows=batch.data||[],selected=excludeCancelled?rows.filter(r=>!isCancelledReservation(r.status)):rows;
  budget.add(selected);output.push(...selected);
  if(rows.length<1000)return output;
 }
}
