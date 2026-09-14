export type TurnstileApi = {
  ready: (callback: () => void) => void;
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme: "auto";
    language: "es";
    size: "flexible";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "timeout-callback": () => void;
    "error-callback": (code: string) => boolean;
  }) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loading: Promise<TurnstileApi> | undefined;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (loading) return loading;
  const request = new Promise<TurnstileApi>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>("script[data-mrmaa-turnstile]");
    let complete = false;
    const timer = window.setTimeout(() => fail(), 15000);
    const cleanup = () => {
      window.clearTimeout(timer);
      script?.removeEventListener("load", ready);
      script?.removeEventListener("error", fail);
    };
    const fail = () => {
      if (complete) return;
      complete = true;
      cleanup();
      script?.remove(); // A retry must be able to request a failed script again.
      reject(new Error("No se pudo cargar la verificación de seguridad."));
    };
    const ready = () => {
      if (complete) return;
      const api = window.turnstile;
      if (!api) { fail(); return; }
      try {
        api.ready(() => {
          if (complete) return;
          complete = true;
          cleanup();
          resolve(api);
        });
      } catch { fail(); }
    };
    if (window.turnstile) { ready(); return; }
    if (!script) {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.mrmaaTurnstile = "true";
    }
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!script.isConnected) document.head.appendChild(script);
  });
  loading = request.catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
