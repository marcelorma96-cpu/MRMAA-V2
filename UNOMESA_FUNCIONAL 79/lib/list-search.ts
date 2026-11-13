"use client";
import { useEffect, useRef, useState } from "react";

/** Only typing waits; initial reads, pagination and team updates start immediately. */
export function useListSearch(value: string, onCommit: () => void, normalize = (text:string) => text.trim().replace(/[%(),]/g, " ")) {
  const normalized = normalize(value);
  const [query, setQuery] = useState(normalized);
  const callback = useRef(onCommit);
  callback.current = onCommit;
  useEffect(() => {
    if (normalized === query) return;
    const timer = setTimeout(() => { setQuery(normalized); callback.current(); }, 250);
    return () => clearTimeout(timer);
  }, [normalized, query]);
  return query;
}
