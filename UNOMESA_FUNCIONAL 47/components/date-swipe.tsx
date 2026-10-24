"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Only this date bar owns the horizontal gesture. A tap retains the calendar. */
export function DateSwipe({ children, className, onPrevious, onNext, disabled = false, enabled = true, label }: {
  children: ReactNode; className: string; onPrevious: () => void; onNext: () => void;
  disabled?: boolean; enabled?: boolean; label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const actions = useRef({ onPrevious, onNext, disabled });
  actions.current = { onPrevious, onNext, disabled };
  useEffect(() => {
    const element = root.current;
    if (!element || !enabled) return;
    let start: { id: number; x: number; y: number; dx: number; locked: boolean } | null = null;
    let suppressUntil = 0;
    const reset = () => { start = null; };
    const unavailable = () => actions.current.disabled || !!element.closest('[inert]');
    const down = (event: TouchEvent) => {
      reset();
      if (unavailable() || event.touches.length !== 1) return;
      const touch = event.touches[0];
      // Leave the operating system's screen-edge navigation alone.
      if (touch.clientX < 24 || touch.clientX > innerWidth - 24) return;
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, dx: 0, locked: false };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      if (unavailable() || event.touches.length !== 1) { reset(); return; }
      const touch = event.touches[0];
      if (touch.identifier !== start.id) { reset(); return; }
      const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
      if (!start.locked) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.6 || !event.cancelable) { reset(); return; }
        start.locked = true;
      }
      if (event.cancelable) event.preventDefault();
      start.dx = dx;
      suppressUntil = Date.now() + 500;
    };
    const end = (event: TouchEvent) => {
      const gesture = start; reset();
      if (!gesture?.locked) return;
      suppressUntil = Date.now() + 500;
      // One deliberate swipe changes one day; a pinch/cancel never changes it.
      if (event.touches.length || unavailable() || Math.abs(gesture.dx) < 56) return;
      if (event.cancelable) event.preventDefault();
      if (gesture.dx < 0) actions.current.onNext(); else actions.current.onPrevious();
    };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressUntil && event.detail !== 0) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    element.addEventListener("touchstart", down, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end, { passive: false });
    element.addEventListener("touchcancel", reset);
    element.addEventListener("click", click, true);
    return () => {
      element.removeEventListener("touchstart", down); element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end); element.removeEventListener("touchcancel", reset);
      element.removeEventListener("click", click, true);
    };
  }, [enabled]);
  return <div ref={root} className={className} translate="no" role="group" aria-label={label}
    data-menu-swipe="off" data-date-swipe={enabled ? "on" : undefined}
    style={enabled ? { touchAction: "pan-y pinch-zoom" } : undefined}>{children}</div>;
}
