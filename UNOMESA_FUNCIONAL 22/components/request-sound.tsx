'use client';
import {useEffect,useRef,useState} from 'react';
import {requestAlertSettings,requestChime} from '@/lib/request-alert';
export function RequestSound({count,settings,en}:{count:number;settings:unknown;en:boolean}) {
 const config=requestAlertSettings(settings), context=useRef<AudioContext|null>(null);
 const [ready,setReady]=useState(false);
 useEffect(()=>{
   let alive=true;
   const unlock=()=>{
     if(!context.current) {
       const Constructor=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
       if(!Constructor)return;
       context.current=new Constructor();
     }
     void context.current.resume().then(()=>{if(alive)setReady(context.current?.state==='running')}).catch(()=>{});
   };
   window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
   return()=>{alive=false;window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);void context.current?.close();context.current=null};
 },[]);
 useEffect(()=>{
   if(!count||!config.enabled||!ready||!config.volume)return;
   const play=()=>{if(!document.hidden&&context.current)requestChime(context.current,config.volume)};
   play();const timer=setInterval(play,config.interval*1000);
   return()=>clearInterval(timer);
 },[count,config.enabled,config.interval,config.volume,ready]);
 if(!count)return null;
 if(!config.enabled||!config.volume)return <small>{en?'Sound disabled in Settings':'Sonido desactivado en Configuración'}</small>;
 return ready?<small>{en?'Sound reminder active':'Recordatorio sonoro activo'}</small>:<button type="button">{en?'Activate sound':'Activar sonido'}</button>;
}
