type Result<T>={data:T|null;error:any};
export type FloorConfirmationKind='conflict'|'capacity';
/** Each exception is confirmed for this write only, never remembered from an earlier save. */
export async function saveWithFloorConfirmation<T>(write:(confirmed:boolean,extraSeats:boolean)=>PromiseLike<Result<T>>,confirm:(kind?:FloorConfirmationKind)=>Promise<boolean>,confirmed=false):Promise<Result<T>|null>{
 let extraSeats=false;
 for(let attempt=0;attempt<3;attempt++){
  const result=await write(confirmed,extraSeats),message=String(result.error?.message||result.error||'');
  if(message.includes('FLOOR_CAPACITY')){if(extraSeats)return {...result,error:{message:'FLOOR_EXTRA_SEATS_REQUIRED'}};if(!await confirm('capacity'))return null;extraSeats=true;continue;}
  if(message.includes('FLOOR_CONFLICT')){if(confirmed)return {...result,error:{message:'FLOOR_OVERRIDE_REQUIRED'}};if(!await confirm('conflict'))return null;confirmed=true;continue;}
  if(['PGRST202','42883'].includes(result.error?.code)){
   if(extraSeats&&message.includes('_extra_seats'))return {...result,error:{message:'FLOOR_EXTRA_SEATS_REQUIRED'}};
   if(confirmed&&message.includes('_confirmed'))return {...result,error:{message:'FLOOR_OVERRIDE_REQUIRED'}};
  }
  return result;
 }
 return {data:null,error:{message:'FLOOR_ASSIGNMENT'}};
}
