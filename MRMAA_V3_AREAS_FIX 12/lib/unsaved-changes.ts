"use client";
import { useEffect, useRef, useState } from "react";

const drafts = new Map<symbol, () => void>();
export function registerUnsavedChanges(key: symbol, discard: () => void) {
  drafts.set(key, discard);
  return () => { drafts.delete(key); };
}
export function confirmDiscardChanges() {
  if (!drafts.size) return true;
  const en = document.documentElement.lang.startsWith("en");
  if (!window.confirm(en
    ? "You have unsaved changes. Discard them and continue?"
    : "Tiene cambios sin guardar. ¿Desea descartarlos y continuar?")) return false;
  const callbacks = [...drafts.values()];
  drafts.clear();
  callbacks.forEach(discard => discard());
  return true;
}

export function useUnsavedChanges(dirty: boolean, discard: () => void) {
  const id = useRef(Symbol("draft"));
  const callback = useRef(discard);
  callback.current = discard;
  useEffect(() => {
    const key = id.current;
    if (dirty) registerUnsavedChanges(key, () => callback.current());
    else drafts.delete(key);
    const warn = (event: BeforeUnloadEvent) => {
      if (!drafts.has(key)) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => { drafts.delete(key); window.removeEventListener("beforeunload", warn); };
  }, [dirty]);
}

export function useDraftBaseline(value: unknown, open = true) {
  const signature = JSON.stringify(value);
  const [saved, setSaved] = useState(signature);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) setSaved(signature);
    wasOpen.current = open;
  }, [open, signature]);
  return { dirty: open && signature !== saved, markSaved: () => setSaved(signature) };
}
