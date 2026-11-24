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

// A sweep is recomputed from its starting selection, so dragging backwards shrinks it.
// Keep original snapshots for conflict detection, even if a live refresh arrives mid-gesture.
export function paintSelection(base:Picked[],cells:Cell[],rows:Map<string,ScheduleRow>):Picked[]|null {
  const all=new Map(base.map(p=>[cellKey(p),p]));
  for(const c of cells)if(!all.has(cellKey(c)))all.set(cellKey(c),{...c,expected:rows.get(cellKey(c))??null});
  return all.size>MAX_CELLS?null:[...all.values()];
}
// Destination taps anchor to the first assigned cell in visual row/date order,
// never the order in which the user happened to tap cells. Empty gaps stay gaps.
export function orderedAssigned(picks:Picked[],people:string[],days:string[]):Picked[] {
  return picks.filter(p=>p.expected).slice().sort((a,b)=>people.indexOf(a.employee_id)-people.indexOf(b.employee_id)||days.indexOf(a.work_date)-days.indexOf(b.work_date));
}

// Explicit transfers map each source employee to a chosen employee. Dates move
// together from the earliest assigned day, including gaps in sparse selections.
// The existing RPC writes sequentially inside one transaction, so a record must
// vacate its source before another selected record can occupy that source.
export function planTransfer(picks:Picked[],destinations:Record<string,string>,firstDate:string,people:string[],days:string[],occupied:Map<string,ScheduleRow>):{ops:Operation[]}|{error:MoveError} {
  const assigned=picks.filter((p):p is Picked & {expected:ScheduleRow}=>!!p.expected);
  if(!assigned.length)return {error:'empty'};
  if(picks.length>MAX_CELLS)return {error:'bounds'};
  const validPeople=new Set(people),start=days.indexOf(firstDate);
  const sourceKeys=new Set<string>();
  let first=days.length;
  for(const p of assigned){
    const day=days.indexOf(p.work_date),key=cellKey(p);
    if(day<0||!validPeople.has(p.employee_id)||!validPeople.has(destinations[p.employee_id])||sourceKeys.has(key))return {error:'bounds'};
    sourceKeys.add(key);first=Math.min(first,day);
  }
  if(start<0)return {error:'bounds'};
  const targets=new Set<string>(),moving=new Map<string,Operation>();
  for(const p of assigned){
    const work_date=days[days.indexOf(p.work_date)+start-first];
    if(!work_date)return {error:'bounds'};
    const to={employee_id:destinations[p.employee_id],work_date},targetKey=cellKey(to);
    if(targets.has(targetKey))return {error:'occupied'};
    targets.add(targetKey);
    if(targetKey!==cellKey(p))moving.set(cellKey(p),{...p,to});
  }
  if(!moving.size)return {error:'same'};
  for(const op of moving.values()){
    const targetKey=cellKey(op.to);
    if(occupied.has(targetKey)&&!moving.has(targetKey))return {error:'occupied'};
  }
  const done=new Set<string>(),visiting=new Set<string>(),ops:Operation[]=[];
  function visit(key:string):boolean {
    if(done.has(key))return true;
    if(visiting.has(key))return false;
    visiting.add(key);
    const op=moving.get(key)!;
    const dependency=cellKey(op.to);
    if(moving.has(dependency)&&!visit(dependency))return false;
    visiting.delete(key);done.add(key);ops.push(op);return true;
  }
  for(const key of moving.keys())if(!visit(key))return {error:'occupied'};
  return {ops};
}
