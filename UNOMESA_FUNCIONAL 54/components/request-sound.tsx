'use client';
import {useEffect,useRef,useState} from 'react';
import {requestAlertSettings} from '@/lib/request-alert';
import {RequestAudioPlayer,type RequestAudioStatus} from '@/lib/request-audio-player';
const TEST_EVENT='unomesa:request-sound-test';
type TestDetail={restaurantId:string;settings:unknown;handled:boolean;report:(status:RequestAudioStatus)=>void};
export function RequestSound({restaurantId,count,settings,en}:{restaurantId:string;count:number;settings:unknown;en:boolean}) {
 const config=requestAlertSettings(settings),player=useRef<RequestAudioPlayer|null>(null);
 const [status,setStatus]=useState<RequestAudioStatus>('idle');
 const testReport=useRef<((status:RequestAudioStatus)=>void)|null>(null);
 useEffect(()=>{
   const audio=new RequestAudioPlayer(next=>{setStatus(next);testReport.current?.(next)});player.current=audio;
   const gesture=()=>audio.gesture();
   const visible=()=>audio.visibility();
   const test=(event:Event)=>{const detail=(event as CustomEvent<TestDetail>).detail;if(detail?.restaurantId!==restaurantId)return;detail.handled=true;testReport.current=detail.report;audio.test(detail.settings)};
   // click covers touch and mouse, after their gesture has been recognized.
   window.addEventListener('click',gesture);window.addEventListener('keydown',gesture);
   document.addEventListener('visibilitychange',visible);window.addEventListener(TEST_EVENT,test);
   return()=>{player.current=null;testReport.current=null;window.removeEventListener('click',gesture);window.removeEventListener('keydown',gesture);document.removeEventListener('visibilitychange',visible);window.removeEventListener(TEST_EVENT,test);audio.dispose()};
 },[restaurantId]);
 useEffect(()=>{player.current?.configure(count>0,config)},[count>0,config.enabled,config.interval,config.volume]);
 if(!count)return null;
 const active=config.enabled&&config.volume>0;
 const label=status==='blocked'?(en?'Tap to allow audio on this device.':'Pulse para permitir audio en este dispositivo.'):status==='error'?(en?'Audio could not play. Try the sound test.':'No se pudo reproducir el audio. Pruebe el sonido.'):status==='playing'?(en?`Playing · every ${config.interval}s`:`Reproduciendo · cada ${config.interval} s`):status==='starting'?(en?'Starting sound…':'Iniciando sonido…'):(en?'Sound needs activation on this device.':'Active el sonido en este dispositivo.');
 return <div><small role="status">{active?label:en?'Sound disabled in Settings':'Sonido desactivado en Configuración'}</small>{active&&<button type="button" onClick={e=>{e.stopPropagation();testReport.current=null;player.current?.activate()}}>{status==='playing'?(en?'Play now':'Escuchar ahora'):(en?'Activate sound':'Activar sonido')}</button>}</div>;
}
export function RequestSoundTest({restaurantId,settings,en}:{restaurantId:string;settings:unknown;en:boolean}) {
 const [status,setStatus]=useState<RequestAudioStatus>('idle');const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const config=requestAlertSettings(settings);
 return <div translate="no"><button type="button" className="secondary" disabled={!config.volume} onClick={e=>{e.stopPropagation();const detail:TestDetail={restaurantId,settings,handled:false,report:next=>{if(alive.current)setStatus(next)}};window.dispatchEvent(new CustomEvent(TEST_EVENT,{detail}));if(!detail.handled)setStatus('error')}}>{en?'Test sound':'Probar sonido'}</button>
 <p role="status">{!config.volume?(en?'Raise alert volume to test.':'Suba el volumen de la alerta para probar.'):status==='error'?(en?'Unable to play. Reload UnoMesa and try again.':'No se pudo reproducir. Recargue UnoMesa e intente de nuevo.'):status==='blocked'?(en?'Your browser blocked audio. Allow sound for UnoMesa and try again.':'El navegador bloqueó el audio. Permita sonido para UnoMesa y vuelva a probar.'):status==='playing'?(en?'Playback started. If inaudible, check device volume, silent mode and audio output.':'Reproducción iniciada. Si no escucha, revise volumen, modo silencio y salida de audio del dispositivo.'):status==='starting'?(en?'Starting…':'Iniciando…'):(en?'Plays two tones on this device. No new request needed.':'Reproduce dos tonos en este dispositivo, sin necesitar una solicitud nueva.')}</p></div>;
}
