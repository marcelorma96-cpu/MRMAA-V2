'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {SYNC_EVENT,type DataChange} from '@/lib/restaurant-sync';

/** One restaurant-scoped count feeds navigation, the notice and its sound. */
export function usePublicRequestCount(restaurantId:string,allowed:boolean){
 const [state,setState]=useState({restaurantId:'',count:0});
 useEffect(()=>{
  if(!allowed||!restaurantId)return;
  let live=true,working=false,queued=false;setState({restaurantId,count:0});
  const load=async()=>{
   if(!live||document.hidden)return;
   if(working){queued=true;return}working=true;
   try{const result=await supabase.rpc('v2_public_unread',{p_restaurant:restaurantId});
    const count=Number(result.data);
    if(live&&!result.error&&Number.isFinite(count)){
     const next=Math.max(0,Math.floor(count));
     setState(current=>current.restaurantId===restaurantId&&current.count===next?current:{restaurantId,count:next});
    }
   }catch{}finally{working=false;if(queued&&live){queued=false;void load()}}
  };
  void load();const timer=setInterval(load,30000);
  const changed=(event:Event)=>{const value=(event as CustomEvent<DataChange>).detail;if(value?.restaurantId===restaurantId&&value.tables.includes('v2_public_requests'))void load()};
  window.addEventListener('unomesa:public-request',load);window.addEventListener('focus',load);window.addEventListener('online',load);
  document.addEventListener('visibilitychange',load);window.addEventListener(SYNC_EVENT,changed);
  return()=>{
   live=false;clearInterval(timer);
   window.removeEventListener('unomesa:public-request',load);window.removeEventListener('focus',load);window.removeEventListener('online',load);
   document.removeEventListener('visibilitychange',load);window.removeEventListener(SYNC_EVENT,changed);
  };
 },[restaurantId,allowed]);
 return allowed&&state.restaurantId===restaurantId?state.count:0;
}
