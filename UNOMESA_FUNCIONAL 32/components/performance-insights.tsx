"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { SpeedInsightsProps } from "@vercel/speed-insights";
import { filterSpeedInsights, speedInsightsPath } from "@/lib/speed-insights";

// Preserve the original URL even if authentication later removes its tokens.
const entryUrl = typeof window === "undefined" ? "" : window.location.href;

/** Operational metrics only; independent from advertising and database reads. */
export function PerformanceInsights({ allowedOrigin }: { allowedOrigin: string }) {
  const active = useRef(false);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    active.current = true;
    setEnabled(!!speedInsightsPath(entryUrl, allowedOrigin)
      && !!speedInsightsPath(window.location.href, allowedOrigin));
    return () => { active.current = false; };
  }, [allowedOrigin]);
  const beforeSend = useCallback<NonNullable<SpeedInsightsProps["beforeSend"]>>(
    event => active.current
      ? filterSpeedInsights(event, entryUrl, window.location.href, allowedOrigin)
      : null,
    [allowedOrigin],
  );
  return enabled ? <SpeedInsights beforeSend={beforeSend} debug={false} sampleRate={1} /> : null;
}
