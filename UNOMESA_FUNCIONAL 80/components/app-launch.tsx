"use client";
import {useContext,useEffect,useLayoutEffect} from 'react';
import {StartupLoadingContext,useStartupPending} from './presentation-loading';
import {setOpeningBusy,settleOpening,watchOpenings} from '@/lib/opening-lifecycle';
const useLayout=typeof window==='undefined'?useEffect:useLayoutEffect;

// One server-rendered curtain, reused from the first paint through the dashboard reveal.
export function OpeningCover(){return <div id="unoOpening" className="unoOpening">
 {(['left','right'] as const).map(side=><div key={side} aria-hidden="true" className={'unoOpeningPanel '+side}><div className="unoOpeningScene"><span className="unoOpeningMark"><b/><i/><em/></span></div></div>)}
 <div className="unoOpeningSlow" role="status"><span>Verificando acceso… / Checking access…</span><button type="button" onClick={()=>window.location.reload()}>Reintentar / Retry</button></div>
 </div>}
export function AccessLoading({text}:{text:string}){
 useStartupPending(true);
 return <main className="center accessLoading" role="status"><span>{text}</span></main>;
}
export function EntryReady({enabled}:{enabled:boolean}){
 const pending=!!useContext(StartupLoadingContext)?.pending;
 useLayout(()=>{if(enabled)return watchOpenings()},[enabled]);
 useLayout(()=>{if(enabled)setOpeningBusy(pending)},[enabled,pending]);
 return null;
}
/** A marker is only rendered by an already authorized account surface. */
export function SignedInOpening({user}:{user:string}){
 useLayout(()=>{settleOpening();return settleOpening},[user]);
 return <span hidden aria-hidden="true" data-uno-gated-surface={user}/>;
}
