// Only the short-lived PKCE verifier survives an iOS view/process restart.
// OAuth session tokens remain in sessionStorage until the primary client accepts them.
const prefix = 'unomesa-google-pkce:';
const ttl = 15 * 60 * 1000;
const isVerifier = (key:string) => key.startsWith('unomesa-google-oauth-') && key.endsWith('-code-verifier');
const nativeIOS = () => /UnoMesa-iOS\//.test(navigator.userAgent);
export const googlePKCEStorage = {
  getItem(key:string) {
    if (nativeIOS() && isVerifier(key)) {
      const saved = localStorage.getItem(prefix + key);
      if (saved) {
        try {
          const item = JSON.parse(saved);
          if (typeof item.value === 'string' && Number.isFinite(item.expiresAt) && item.expiresAt > Date.now() && item.expiresAt <= Date.now() + ttl) return item.value;
        } catch {}
        localStorage.removeItem(prefix + key);
        return null;
      }
    }
    return sessionStorage.getItem(key);
  },
  setItem(key:string,value:string) {
    if (nativeIOS() && isVerifier(key)) {
      localStorage.setItem(prefix + key, JSON.stringify({value,expiresAt:Date.now()+ttl}));
      sessionStorage.removeItem(key);
    } else sessionStorage.setItem(key,value);
  },
  removeItem(key:string) {
    if (isVerifier(key)) localStorage.removeItem(prefix + key);
    sessionStorage.removeItem(key);
  },
};
export function clearStoredGooglePKCE() {
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
}
