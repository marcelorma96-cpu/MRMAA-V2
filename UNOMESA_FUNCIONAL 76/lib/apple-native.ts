type AppleBridge = { postMessage(payload: { nonce: string }): Promise<{ idToken?: string; code?: string; cancelled?: boolean }> };
export function appleNativeBridge(): AppleBridge | null {
  if (typeof window === 'undefined' || window.top !== window || !/\bUnoMesa-iOS\//.test(window.navigator.userAgent)) return null;
  const host = window as Window & { webkit?: { messageHandlers?: { unoMesaApple?: AppleBridge } } };
  const bridge = host.webkit?.messageHandlers?.unoMesaApple;
  return typeof bridge?.postMessage === 'function' ? bridge : null;
}
export async function requestAppleCredential(bridge: AppleBridge) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
  const result = await bridge.postMessage({ nonce });
  if (result?.cancelled) return null;
  if (typeof result?.idToken !== 'string' || !result.idToken || typeof result.code !== 'string' || !result.code) throw new Error('APPLE_UNAVAILABLE');
  return { provider: 'apple' as const, token: result.idToken, code:result.code, nonce };
}
