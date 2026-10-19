import {formatEventTime} from './local-date';

export type ReservationPrintTime = {mode:'all'|'range';from:string;to:string};
export const allReservationPrintTimes:ReservationPrintTime = {mode:'all',from:'00:00',to:'23:59'};
const minute = (time?:string|null) => {
  if(!time || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(time)) return NaN;
  return Number(time.slice(0,2))*60+Number(time.slice(3,5));
};
export function reservationPrintTimeError(selection:ReservationPrintTime,en=false){
  if(selection.mode==='all')return '';
  const from=minute(selection.from),to=minute(selection.to);
  if(!/^\d{2}:\d{2}$/.test(selection.from)||!/^\d{2}:\d{2}$/.test(selection.to)||!Number.isFinite(from)||!Number.isFinite(to))return en?'Choose a start and end time.':'Seleccione una hora de inicio y otra de fin.';
  return to<from?(en?'The end time must be at or after the start time, on the same day.':'La hora final debe ser igual o posterior a la inicial, en el mismo día.') : '';
}
/** Filter by arrival time, including both endpoint minutes; never convert time zones. */
export function matchesReservationPrintTime(time:string|null|undefined,selection:ReservationPrintTime){
  if(selection.mode==='all')return true;
  if(reservationPrintTimeError(selection))return false;
  const value=minute(time);
  return Number.isFinite(value)&&value>=minute(selection.from)&&value<=minute(selection.to);
}
/** Apply before pagination and export limits; retains the caller's tenant/date/search filters. */
export function applyReservationPrintTime(query:any,selection:ReservationPrintTime){
  if(selection.mode==='all')return query;
  if(reservationPrintTimeError(selection))throw Error('INVALID_PRINT_TIME');
  return query.gte('event_time',`${selection.from}:00`).lte('event_time',`${selection.to}:59.999999`);
}
export function reservationPrintTimeLabel(selection:ReservationPrintTime,en=false,timeFormat?:string){
  return selection.mode==='all'?(en?'All times':'Todo el horario'):`${en?'From':'Desde'} ${formatEventTime(selection.from,timeFormat)} ${en?'to':'hasta'} ${formatEventTime(selection.to,timeFormat)}`;
}
