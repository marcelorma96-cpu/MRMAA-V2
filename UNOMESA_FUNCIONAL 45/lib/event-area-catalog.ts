import type { SupabaseClient } from '@supabase/supabase-js';
import { readCatalog } from './account-access';
import { requirePermission } from './permissions';
import type { EventArea } from './floor-plan';

const key=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();

/** Create in the existing catalog, reusing an area's ID and historical links. */
export async function ensureEventArea(client:SupabaseClient,restaurantId:string,rawName:string):Promise<EventArea> {
 const name=rawName.trim().replace(/\s+/g,' ');
 if(!name||name.length>60)throw Error('FLOOR_AREA_NAME');
 await requirePermission(client,restaurantId,'canManageReservationAreas');
 const find=async()=>{const result=await readCatalog(client,restaurantId,'v2_reservation_areas','name',false);if(result.error)throw result.error;return result.data?.find(a=>key(a.name)===key(name));};
 const reuse=async(area:{id:string;name:string;active?:boolean})=>{
  if(area.active!==false)return {id:area.id,name:area.name};
  // Reactivate only; never rename or replace a historical catalog record.
  const restored=await client.from('v2_reservation_areas').update({active:true}).eq('restaurant_id',restaurantId).eq('id',area.id).select('id,name').single();
  if(restored.error)throw restored.error;return restored.data as EventArea;
 };
 const existing=await find();if(existing)return reuse(existing);
 const created=await client.from('v2_reservation_areas').insert({restaurant_id:restaurantId,name}).select('id,name').single();
 if(!created.error)return created.data as EventArea;
 if(created.error.code==='23505'){const concurrent=await find();if(concurrent)return reuse(concurrent);}
 throw created.error;
}
