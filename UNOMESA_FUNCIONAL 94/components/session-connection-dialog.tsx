"use client";
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// A native modal blocks the entire document, including other portals and
// calendars in the top layer, without unmounting an already authorized form.
export function SessionConnectionDialog({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => {
      element.close();
      if (before?.isConnected && !before.closest('[inert],[hidden]')) before.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="sessionConnectionDialog" aria-label="Conexión / Connection"
    onCancel={event => event.preventDefault()} onKeyDown={event => {
      event.stopPropagation();
      // A loading-only dialog has no buttons to cycle through. Keep keyboard
      // focus in the blocking layer until the suspended surface is ready.
      if (event.key === 'Tab' && !event.currentTarget.querySelector('button:not([disabled]),input:not([disabled]),a[href],[tabindex="0"]')) {
        event.preventDefault(); event.currentTarget.focus({preventScroll:true});
      }
    }}>
    {children}
  </dialog>, document.body);
}
