// A selection is a list of exact employee/day pairs, never employees × dates.
import type {ScheduleRow} from "./schedule-range";
export type Cell = {employee_id:string;work_date:string};
export type Picked = Cell & {expected:ScheduleRow|null};
export type Operation = Picked & {to:Cell};
export const cellKey=(c:Cell)=>c.employee_id+"|"+c.work_date;
export const MAX_CELLS=500;
export function rectangle(a:Cell,b:Cell,people:string[],days:string[]):Cell[] {
  const i=people.indexOf(a.employee_id), j=people.indexOf(b.employee_id);
  const x=days.indexOf(a.work_date),y=days.indexOf(b.work_date);
  if(Math.min(i,j,x,y)<0)return [b];
  return people.slice(Math.min(i,j),Math.max(i,j)+1).flatMap(employee_id=>
    days.slice(Math.min(x,y),Math.max(x,y)+1).map(work_date=>({employee_id,work_date})));
}
export type MoveError = 'empty'|'bounds'|'occupied'|'same';
export function planMove(picks:Picked[],anchor:Cell,target:Cell,people:string[],days:string[],occupied:Map<string,ScheduleRow>): {error:MoveError}|{ops:Operation[]} {
  if(!picks.length||picks.some(p=>!p.expected))return {error:'empty'};
  const fromRow=people.indexOf(anchor.employee_id),toRow=people.indexOf(target.employee_id),fromDay=days.indexOf(anchor.work_date),toDay=days.indexOf(target.work_date);
  if(Math.min(fromRow,toRow,fromDay,toDay)<0)return {error:'bounds'};
  const dr=toRow-fromRow,dc=toDay-fromDay;
  if(!dr&&!dc)return {error:'same'};
  const selected=new Set(picks.map(cellKey)),result:Operation[]=[];
  for(const p of picks){
    const row=people.indexOf(p.employee_id), col=days.indexOf(p.work_date);
    const employee_id=people[row+dr],work_date=days[col+dc];
    if(row<0||col<0||!employee_id||!work_date)return {error:'bounds'};
    const to={employee_id,work_date};
    if(occupied.has(cellKey(to))&&!selected.has(cellKey(to)))return {error:'occupied'};
    result.push({...p,to});
  }
  // Move the leading edge first so overlapping translations keep every row ID.
  const order=(c:Cell)=>people.indexOf(c.employee_id)*dr+days.indexOf(c.work_date)*dc;
  return {ops:result.sort((a,b)=>order(b)-order(a))};
}
