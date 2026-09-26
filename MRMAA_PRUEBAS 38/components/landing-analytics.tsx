"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import type { BeforeSendEvent } from "@vercel/analytics/react";
import { isPublicLandingUrl } from "@/lib/meta-pixel";
import { filterLandingAnalytics } from "@/lib/vercel-analytics";

// Capture before auth restoration can remove callback tokens from the URL.
const entryUrl = typeof window === "undefined" ? "" : window.location.href;

/** Mounted only by the anonymous landing, after the existing auth check. */
export function LandingAnalytics() {
  const active = useRef(false);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    active.current = true;
    setEnabled(process.env.NODE_ENV === "production"
      && process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED !== "false"
      && isPublicLandingUrl(entryUrl) && isPublicLandingUrl(window.location.href));
    return () => { active.current = false; };
  }, []);
  const beforeSend = useCallback((event: BeforeSendEvent) =>
    filterLandingAnalytics(event, entryUrl, window.location.href, active.current), []);

  return enabled ? <Analytics beforeSend={beforeSend} debug={false} /> : null;
}
