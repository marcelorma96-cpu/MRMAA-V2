// Presentation preference only. Never use this to authorize data or permissions.
export function isAppMode() {
 if (typeof window === 'undefined') return false;
 if (/UnoMesa-(iOS|Android)\//.test(navigator.userAgent) || location.pathname === '/mobile' || matchMedia('(display-mode: standalone)').matches) return true;
 try { return sessionStorage.getItem('unomesa-app-mode') === '1'; } catch { return false; }
}
export function initializeAppMode() {
 if (!isAppMode()) return;
 document.documentElement.dataset.unomesaApp = 'true';
 try { sessionStorage.setItem('unomesa-app-mode','1'); } catch {}
}
export function sessionActivityStorage(): Storage { return isAppMode() ? localStorage : sessionStorage; }
export const APP_IDLE_LIMIT = 30 * 24 * 60 * 60 * 1000;

export function nativeAppMessage(type: 'appReady' | 'tools') {
 const host = window as Window & { webkit?: {messageHandlers?: {unomesa?: {postMessage:(body:{type:string})=>void}}}};
 host.webkit?.messageHandlers?.unomesa?.postMessage({type});
}
