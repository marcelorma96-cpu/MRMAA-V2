import type {SupabaseClient} from '@supabase/supabase-js';
import type {FloorData} from './floor-plan';
import {requirePermission} from './permissions';
import {floorDefaultDuration,validFloorDuration} from './restaurant-map';
export const FLOOR_DEFAULT_CHANGED='unomesa-floor-default-changed';
function announce(restaurantId:string,data:FloorData){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(FLOOR_DEFAULT_CHANGED,{detail:{restaurantId,layout:data.layout,revision:data.revision}}));return data}
/** Merge only this preference into a fresh, revision-checked layout. Never touch seatings. */
export async function saveFloorDuration(client:SupabaseClient,restaurantId:string,date:string,minutes:number):Promise<FloorData>{
 if(!validFloorDuration(minutes))throw Error('FLOOR_ASSIGNMENT');
 await requirePermission(client,restaurantId,'canManageSchedules');
 for(let attempt=0;attempt<2;attempt++){
  const read=await client.rpc('v2_floor_read',{p_restaurant_id:restaurantId,p_date:date});if(read.error)throw read.error;
  const data=read.data as FloorData;if(floorDefaultDuration(data.layout)===minutes)return announce(restaurantId,data);
  const layout={...data.layout,defaultDurationMinutes:minutes};
  const saved=await client.rpc('v2_floor_save_layout',{p_restaurant_id:restaurantId,p_revision:data.revision,p_layout:layout});
  if(saved.error){if(attempt===0&&saved.error.message.includes('FLOOR_STALE'))continue;throw saved.error;}
  return announce(restaurantId,{...data,layout,revision:saved.data});
 }
 throw Error('FLOOR_STALE');
}
