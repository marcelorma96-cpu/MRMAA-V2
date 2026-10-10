"use client";

import { useEffect, useState } from "react";
import { configured, supabase } from "@/lib/supabase";
import { startLandingPixel } from "@/lib/meta-pixel";
import { startLandingGoogleAds } from "@/lib/google-ads";
import { LandingAnalytics } from "./landing-analytics";

/** Public content only. An existing session or failed auth check disables measurement. */
export function PublicMarketingAnalytics() {
  const [anonymous, setAnonymous] = useState(false);
  useEffect(() => {
    if (!configured) return;
    let current = true, sessionChanged = false;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION") sessionChanged = true;
      if (current && (session || sessionChanged)) setAnonymous(false);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (current && !sessionChanged) setAnonymous(!error && !data.session);
    }).catch(() => { if (current) setAnonymous(false); });
    return () => { current = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (anonymous) return startLandingPixel(); }, [anonymous]);
  useEffect(() => { if (anonymous) return startLandingGoogleAds(); }, [anonymous]);
  return anonymous ? <LandingAnalytics /> : null;
}
