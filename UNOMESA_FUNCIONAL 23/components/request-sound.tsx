'use client';
import {useEffect,useRef,useState} from 'react';
import {requestAlertSettings,startRequestAlert} from '@/lib/request-alert';
export function RequestSound({count,settings,en}:{count:number;settings:unknown;en:boolean}) {
 const config=requestAlertSettings(settings), context=useRef<AudioContext|null>(null);
 const [ready,setReady]=useState(false),[visible,setVisible]=useState(true);
 const unlockRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
   let alive=true,resuming=false;
   const state=()=>{if(alive)setReady(context.current?.state==='running')};
   const unlock=()=>{
     try {
       if(!context.current||context.current.state==='closed') {
         const Constructor=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
         if(!Constructor)return;
         context.current=new Constructor();context.current.addEventListener('statechange',state);
       }
       if(context.current.state==='running'){state();return}
       if(resuming)return;resuming=true;
       void context.current.resume().then(state).catch(state).finally(()=>{resuming=false});
     }catch{state()}
   };
   const visibility=()=>{
     if(!alive)return;
     setVisible(!document.hidden);
     // Resume an already authorized context on return; never assume it stayed active.
     if(!document.hidden&&context.current)unlock();
   };
   unlockRef.current=unlock;visibility();
   window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
   window.addEventListener('focus',visibility);document.addEventListener('visibilitychange',visibility);
   return()=>{alive=false;unlockRef.current=()=>{};window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);window.removeEventListener('focus',visibility);document.removeEventListener('visibilitychange',visibility);context.current?.removeEventListener('statechange',state);void context.current?.close().catch(()=>{});context.current=null};
 },[]);
 const pending=count>0;
 useEffect(()=>{
   if(!pending||!config.enabled||!ready||!visible||!config.volume||!context.current)return;
   // Audio engine owns repetition; dashboard renders and JS timers cannot cut it short.
   return startRequestAlert(context.current,config.volume,config.interval);
 },[pending,config.enabled,config.interval,config.volume,ready,visible]);
 if(!pending)return null;
 if(!config.enabled||!config.volume)return <small>{en?'Sound disabled in Settings':'Sonido desactivado en Configuración'}</small>;
 return ready&&visible?<small>{en?`Sound repeats every ${config.interval}s`:`Sonido cada ${config.interval} s`}</small>:<button type="button" onClick={()=>unlockRef.current()}>{en?'Activate / resume sound':'Activar / reanudar sonido'}</button>;
}
