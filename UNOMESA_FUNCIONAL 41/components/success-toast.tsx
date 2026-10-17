"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useAppPreferences } from "@/components/app-preferences";

const SuccessToastContext = createContext<(message: string) => void>(() => {});
export const useSuccessToast = () => useContext(SuccessToastContext);

/** Only confirmed successes use this channel; actionable errors stay in their forms. */
export function SuccessToastProvider({ children }: { children: ReactNode }) {
  const { language, t } = useAppPreferences();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const sequence = useRef(0);
  const show = useCallback((message: string) => {
    setPaused(false);
    setToast({ id: ++sequence.current, message });
  }, []);
  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(() => setToast(current => current?.id === toast.id ? null : current), 5000);
    return () => window.clearTimeout(timer);
  }, [toast, paused]);
  return <SuccessToastContext.Provider value={show}>
    {children}
    <div className="successToastViewport" role="status" aria-live="polite" aria-atomic="true" translate="no">
      {toast && <div className="successToast" key={toast.id}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
        <CheckCircle2 aria-hidden="true" />
        <span>{t(toast.message)}</span>
        <button type="button" aria-label={language === "en" ? "Dismiss notification" : "Cerrar aviso"} onClick={() => setToast(null)}><X aria-hidden="true" /></button>
      </div>}
    </div>
  </SuccessToastContext.Provider>;
}
