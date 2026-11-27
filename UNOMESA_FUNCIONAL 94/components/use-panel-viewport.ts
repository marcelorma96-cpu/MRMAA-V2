"use client";
import {useLayoutEffect,useState,type CSSProperties} from 'react';

/** Fit overlays to the visible viewport, including the iOS software keyboard. */
export function usePanelViewport(open:boolean):CSSProperties|undefined {
  const [style,setStyle]=useState<CSSProperties>();
  useLayoutEffect(()=>{
    if(!open)return;
    const viewport=window.visualViewport;
    if(!viewport)return;
    let frame=0;
    const measure=()=>setStyle({top:viewport.offsetTop,height:viewport.height,bottom:'auto','--panel-height':`${viewport.height}px`} as CSSProperties);
    const update=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(measure);
    };
    measure();
    viewport.addEventListener('resize',update);
    viewport.addEventListener('scroll',update);
    return()=>{cancelAnimationFrame(frame);viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update)};
  },[open]);
  return style;
}
