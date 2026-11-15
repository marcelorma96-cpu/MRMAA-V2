import {SYNC_EVENT,type DataChange} from './restaurant-sync';
/** Invalidate mounted readers immediately after a successful atomic floor/event save. */
export function notifyFloorChange(restaurantId:string){
 window.dispatchEvent(new CustomEvent<DataChange>(SYNC_EVENT,{detail:{restaurantId,tables:['v2_reservations','v2_quotes']}}));
}
