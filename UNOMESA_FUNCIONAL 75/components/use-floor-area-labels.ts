"use client";
import {useModulePending} from './presentation-loading';
import {useEffect,useState} from 'react';
import {readEventAreaLabels} from '@/lib/floor-area-label';
import {useDataRefresh} from './restaurant-sync';
import {supabase} from '@/lib/supabase';
export function useFloorAreaLabels(restaurantId:string,kind:'reservation'|'quote',events:{id:string;area:string;event_date:string}[],en:boolean,version:string|number=0,enabled=true){
 const floorVersion=useDataRefresh(restaurantId,'v2_reservations,v2_quotes,v2_floor_plans,v2_floor_seatings,v2_floor_quote_plans');
 const key=JSON.stringify(events.map(r=>({id:r.id,area:r.area,event_date:r.event_date}))),scope=JSON.stringify([restaurantId,kind,key,en,version,floorVersion,enabled]);
 // A refresh must not replace long table labels with shorter area names and back.
 // Reuse labels only for the same tenant, language and unchanged event identity.
 const context=JSON.stringify([restaurantId,kind,en,enabled]);
 const [state,setState]=useState<{scope:string;context:string;events:typeof events;labels:Record<string,string>;loading:boolean;error:boolean}>({scope:'',context:'',events:[],labels:{},loading:false,error:false});
 const retained=(previous:typeof state)=>previous.context===context?Object.fromEntries(events.filter(r=>previous.events.some(old=>old.id===r.id&&old.area===r.area&&old.event_date===r.event_date)&&previous.labels[r.id]).map(r=>[r.id,previous.labels[r.id]])):{};
 useEffect(()=>{const c=new AbortController();if(!enabled||!restaurantId||key==='[]'){setState({scope,context,events:[],labels:{},loading:false,error:false});return;}
  setState(previous=>({scope,context,events:JSON.parse(key),labels:retained(previous),loading:true,error:false}));
  readEventAreaLabels(supabase,restaurantId,kind,JSON.parse(key),en,c.signal).then(labels=>{if(!c.signal.aborted)setState({scope,context,events:JSON.parse(key),labels,loading:false,error:false})}).catch(()=>{if(!c.signal.aborted)setState(previous=>({...previous,loading:false,error:true}))});return()=>c.abort();
 },[scope,restaurantId,kind,key,en,enabled]);
 const current=state.scope===scope?state:{scope,labels:retained(state),loading:enabled&&!!restaurantId&&key!=='[]',error:false};
 useModulePending(current.loading);
 return current;
}
