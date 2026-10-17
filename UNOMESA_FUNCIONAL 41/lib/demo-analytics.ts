import { track } from "@vercel/analytics";
import { isPublicLandingUrl } from "./meta-pixel";

export type DemoEvent = "Demo_abierta" | "Demo_cotizacion_vista" | "Demo_reserva_creada" | "Demo_registro_click";
export type DemoFlow = "quote" | "direct";
const names = new Set<DemoEvent>(["Demo_abierta", "Demo_cotizacion_vista", "Demo_reserva_creada", "Demo_registro_click"]);

/** Anonymous demo only. Never send entered values or advertising conversions. */
export function trackDemoEvent(name: DemoEvent, flow: DemoFlow): void {
  try {
    if (!names.has(name) || !["quote", "direct"].includes(flow)
      || typeof window === "undefined" || process.env.NODE_ENV !== "production"
      || process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "false"
      || !isPublicLandingUrl(window.location.href)) return;
    track(name, { flow });
  } catch { /* Measurement must not interrupt the demonstration. */ }
}
