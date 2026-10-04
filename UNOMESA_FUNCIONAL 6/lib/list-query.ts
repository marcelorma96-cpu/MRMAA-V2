"use client";
import { useEffect, useRef, useState } from "react";

import {useModulePending} from "@/components/presentation-loading";

type Reader<T> = {
  read: (signal: AbortSignal) => Promise<T>;
  onData: (value: T) => void;
  onError: (error: unknown) => void;
  onLoading: (loading: boolean) => void;
};

/** Team updates queue one follow-up instead of repeatedly aborting a slow read. */
export function createReadQueue<T>({ read, onData, onError, onLoading }: Reader<T>) {
  const controller = new AbortController();
  let stopped = false, running = false, pending = false;
  async function run() {
    if (stopped) return;
    if (running) { pending = true; return; }
    running = true; onLoading(true);
    do {
      pending = false;
      try {
        const value = await read(controller.signal);
        if (!stopped) onData(value);
      } catch (error) { if (!stopped) onError(error); }
    } while (pending && !stopped);
    running = false;
    if (!stopped) onLoading(false);
  }
  return {
    refresh() { void run(); },
    stop() { stopped = true; pending = false; controller.abort(); },
  };
}

/** Changing filters cancels the previous read; invalidations keep the first response useful. */
export function useListQuery<T>(options: Reader<T> & { queryKey: string | undefined; version: string }) {
  const [initialPending,setInitialPending]=useState(!!options.queryKey);
  useModulePending(initialPending);
  const latest = useRef(options); latest.current = options;
  const queue = useRef<ReturnType<typeof createReadQueue<T>> | null>(null);
  const previousVersion = useRef(options.version);
  useEffect(() => {
    previousVersion.current = latest.current.version;
    if (!options.queryKey) {setInitialPending(false);return;}
    const reader = createReadQueue({...latest.current,onLoading:value=>{latest.current.onLoading(value);setInitialPending(value)}});
    queue.current = reader;
    reader.refresh();
    return () => { reader.stop(); if (queue.current === reader) queue.current = null; };
  }, [options.queryKey]);
  useEffect(() => {
    if (previousVersion.current === options.version) return;
    previousVersion.current = options.version;
    queue.current?.refresh();
  }, [options.version]);
}
