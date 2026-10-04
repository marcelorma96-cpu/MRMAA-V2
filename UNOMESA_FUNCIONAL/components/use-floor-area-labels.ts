"use client";
import {useEffect,useState} from 'react';
import {readEventAreaLabels} from '@/lib/floor-area-label';
import {useDataRefresh} from './restaurant-sync';
import {supabase} from '@/lib/supabase';
export function useFloorAreaLabels(restaurantId:string,kind:'reservation'|'quote',events:{id:string;area:string;event_date:string}[],en:boolean,version:string|number=0,enabled=true){
 const floorVersion=useDataRefresh(restaurantId,'v2_reservations,v2_quotes');
 const key=JSON.stringify(events.map(r=>({id:r.id,area:r.area,event_date:r.event_date}))),scope=JSON.stringify([restaurantId,kind,key,en,version,floorVersion,enabled]);
 const [state,setState]=useState<{scope:string;labels:Record<string,string>;loading:boolean;error:boolean}>({scope:'',labels:{},loading:false,error:false});
 useEffect(()=>{const c=new AbortController();if(!enabled||!restaurantId||key==='[]'){setState({scope,labels:{},loading:false,error:false});return;}
  setState({scope,labels:{},loading:true,error:false});readEventAreaLabels(supabase,restaurantId,kind,JSON.parse(key),en,c.signal).then(labels=>{if(!c.signal.aborted)setState({scope,labels,loading:false,error:false})}).catch(()=>{if(!c.signal.aborted)setState({scope,labels:{},loading:false,error:true})});return()=>c.abort();
 },[scope,restaurantId,kind,key,en,enabled]);
 return state.scope===scope?state:{scope,labels:{},loading:enabled&&!!restaurantId&&key!=='[]',error:false};
}
