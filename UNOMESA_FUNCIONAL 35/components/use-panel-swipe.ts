"use client";
import {useEffect, useRef, type RefObject} from 'react';
import {hasMenuBlockingLayer} from './use-menu-swipe';

/** Left swipe on free module content. The calendar, inputs and menus own their gestures. */
export function usePanelSwipe(root: RefObject<HTMLElement|null>, enabled: boolean, open: () => void) {
 const callback = useRef(open); callback.current = open;
 useEffect(() => {
  const element = root.current;
  if (!enabled || !element) return;
  let start: {id:number;x:number;y:number;dx:number;locked:boolean}|null = null;
  let suppressUntil = 0;
  const reset = () => {start = null; element.removeAttribute('data-panel-swiping')};
  const blocked = () => hasMenuBlockingLayer() || !!element.closest('[inert], [data-menu-open="true"], [data-menu-dragging="true"]');
  const down = (event: TouchEvent) => {
   reset();
   if (event.touches.length !== 1 || blocked()) return;
   const target = event.target;
   if (!(target instanceof Element) || target.closest('button,a,input,select,textarea,form,[contenteditable],.monthlyTable,.mapViewport,[data-menu-swipe="off"]')) return;
   for (let el: Element|null = target; el && el !== element; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return;
   }
   const touch = event.touches[0];
   // Keep the OS edge gestures available.
   if (touch.clientX < 24 || touch.clientX > innerWidth - 24) return;
   start = {id:touch.identifier,x:touch.clientX,y:touch.clientY,dx:0,locked:false};
  };
  const move = (event: TouchEvent) => {
   if (!start) return;
   if (event.touches.length !== 1 || blocked()) {reset(); return;}
   const touch = event.touches[0];
   if (touch.identifier !== start.id) {reset(); return;}
   const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
   if (!start.locked) {
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    if (dx >= 0 || Math.abs(dx) < Math.abs(dy) * 1.6 || !event.cancelable) {reset(); return;}
    start.locked = true; element.dataset.panelSwiping = 'true';
   }
   if (event.cancelable) event.preventDefault();
   start.dx = dx; suppressUntil = Date.now() + 450;
  };
  const up = () => {
   const commit = !!start?.locked && start.dx <= -72;
   reset(); if (commit) callback.current();
  };
  const click = (event: MouseEvent) => {
   if (Date.now() < suppressUntil && event.detail !== 0) {event.preventDefault(); event.stopImmediatePropagation();}
  };
  element.addEventListener('touchstart', down, {passive:true});
  element.addEventListener('touchmove', move, {passive:false});
  element.addEventListener('touchend', up); element.addEventListener('touchcancel', reset);
  element.addEventListener('click', click, true);
  return () => {
   reset(); element.removeEventListener('touchstart', down); element.removeEventListener('touchmove', move);
   element.removeEventListener('touchend', up); element.removeEventListener('touchcancel', reset);
   element.removeEventListener('click', click, true);
  };
 }, [root, enabled]);
}
