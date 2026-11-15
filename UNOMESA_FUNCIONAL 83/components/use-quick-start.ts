"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mergeQuickStart, parseQuickStart, quickStartMetadataKey, quickStartStorageKey, saveQuickStart, type QuickStartProgress, type QuickStartTarget } from "@/lib/quick-start";

export function useQuickStart(userId: string, restaurantId: string, metadata: Record<string, unknown>, legacyCompleted: boolean) {
  const key = quickStartStorageKey(userId, restaurantId);
  const [state, setState] = useState<{ key: string; ready: boolean; progress: QuickStartProgress | null }>({ key, ready: false, progress: null });
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(false);
  const latest = useRef(state); latest.current = state;
  const owner = useRef(key); owner.current = key;
  const lock = useRef(false);
  const initialMetadata = useRef(metadata); initialMetadata.current = metadata;
  function storeProgress(progress: QuickStartProgress | null) {
    const next = { key, ready: true, progress }; latest.current = next; setState(next);
    if (progress) try { localStorage.setItem(key, JSON.stringify(progress)); } catch { /* Remote preferences still persist. */ }
  }
  useEffect(() => {
    let live = true, local: QuickStartProgress | null = null;
    setOpen(false); setError(false); setSaving(false); lock.current = false;
    try {
      local = parseQuickStart(JSON.parse(localStorage.getItem(key) || "null"));
      if (!local && localStorage.getItem(`mrmaa-setup-later:${restaurantId}:${userId}`) === "1") local = { status: "dismissed", step: "reservations", updatedAt: 0 };
    } catch { /* Optional device preference. */ }
    const initial = { key, ready: false, progress: mergeQuickStart(local, parseQuickStart(initialMetadata.current[quickStartMetadataKey(restaurantId)])) };
    latest.current = initial; setState(initial);
    // Completion on another device must stay completed.
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!live || owner.current !== key || error || data.user?.id !== userId) return;
      const merged = mergeQuickStart(latest.current.progress, parseQuickStart(data.user.user_metadata[quickStartMetadataKey(restaurantId)]));
      storeProgress(merged);
      if (merged?.status === "completed") setOpen(false);
    }).catch(() => { /* An unavailable preference never blocks restaurant access. */ }).finally(() => {
      if (live && owner.current === key && !latest.current.ready) storeProgress(latest.current.progress);
    });
    return () => { live = false; };
  }, [key, restaurantId, userId]);
  const progress = state.key === key ? state.progress : null;
  const completed = legacyCompleted || progress?.status === "completed";
  const available = state.key === key && state.ready && !completed;
  function start() { if (available) { setOpen(true); setError(false); } }
  function move(step: QuickStartTarget) { storeProgress({ status: "active", step, updatedAt: Date.now() }); }
  async function finish(status: "dismissed" | "completed", step: QuickStartTarget) {
    if (lock.current) return false;
    lock.current = true; setSaving(true); setError(false);
    const progress: QuickStartProgress = { status, step, updatedAt: Date.now() };
    try {
      const saved = await saveQuickStart(supabase, userId, restaurantId, progress);
      if (owner.current !== key) return false;
      storeProgress(saved); setOpen(false); return true;
    } catch {
      if (owner.current === key) setError(true);
      return false;
    } finally {
      if (owner.current === key) { lock.current = false; setSaving(false); }
    }
  }
  // Closing is always possible, even offline. Account synchronization can be retried later.
  function close(step: QuickStartTarget) { storeProgress({ status: "dismissed", step, updatedAt: Date.now() }); setOpen(false); setError(false); }
  return { available, open: available && open, progress, saving, error, start, move, finish, close };
}
