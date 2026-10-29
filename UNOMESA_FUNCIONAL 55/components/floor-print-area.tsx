import {useId} from 'react';
import type {FloorData} from '@/lib/floor-plan';
import {floorAreaBounds,floorAreaViewport} from '@/lib/floor-area-bounds';
import {tableDaySchedules} from '@/lib/floor-table-schedule';
import {FloorTableGraphic} from './floor-table-graphic';

/** Redraw the saved room with the print selection, independently of the working canvas. */
export function FloorPrintArea({data,areaId,date,timeFormat,en,states}:{data:FloorData;areaId:string;date:string;timeFormat?:string;en:boolean;states:Map<string,string>}){
 const pattern=useId().replace(/:/g,''),area=data.layout.areas.find(a=>a.id===areaId),tables=data.layout.tables.filter(t=>t.areaId===areaId),bounds=floorAreaBounds(tables),viewport=floorAreaViewport(bounds),schedules=tableDaySchedules(data,date,timeFormat);
 return <svg xmlns="http://www.w3.org/2000/svg" data-print-area={areaId} data-print-title={area?.name||''} data-print-areas={JSON.stringify([areaId])} viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}>
  <defs><pattern id={pattern} width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#cbd5db" opacity=".55"/></pattern></defs>
  <rect {...viewport} fill={`url(#${pattern})`}/><rect {...bounds} rx="16" fill="none" stroke="#b9c8cc" strokeWidth="3"/>
  {tables.map(table=><g key={table.id} data-table={table.id} transform={`translate(${table.x*10} ${table.y*6.5})`}><FloorTableGraphic allBookings table={table} bookings={schedules.get(table.id)} state={states.get(table.id)||'free'} en={en}/></g>)}
  {!tables.length&&<text x="500" y="315" textAnchor="middle" fontSize="22" fill="#71838b">{en?'No tables in this area':'No hay mesas en esta área'}</text>}
 </svg>;
}
