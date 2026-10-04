"use client";
import {useEffect,useState} from 'react';
import {useAppMode} from './app-context';

export function AppLoading(){
 return <div className="appBrandLoading" role="status" aria-label="UnoMesa"><img src="/mobile-app-icon.png" width="104" height="104" alt="" draggable={false}/><strong>UnoMesa</strong><span className="appBrandPulse" aria-hidden="true"/></div>;
}
/** Presentation only: access checks continue underneath and remain authoritative. */
export function AppLaunch({enabled=false}:{enabled?:boolean}){
 const detected=useAppMode(),app=enabled||detected,[visible,setVisible]=useState(true);
 useEffect(()=>{if(!app)return;const timer=setTimeout(()=>setVisible(false),2000);return()=>clearTimeout(timer)},[app]);
 return app&&visible?<div className="appLaunchOverlay"><AppLoading/></div>:null;
}
export function AccessLoading({text}:{text:string}){
 const app=useAppMode();
 return <main className="center accessLoading"><div className={app?'appLoadingBrand':'appLoadingBrand appOnlyLoading'}><AppLoading/></div><div className={app?'webAccessLoading hidden':'webAccessLoading'} role="status" aria-live="polite"><div className="loader"/><p>{text}</p></div></main>;
}
