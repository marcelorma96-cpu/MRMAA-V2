// Presentation preference only. Never use this to authorize data or permissions.
export function isAppMode() {
 if (typeof window === 'undefined') return false;
 if (/UnoMesa-(iOS|Android)\//.test(navigator.userAgent) || location.pathname === '/mobile' || document.documentElement.dataset.unomesaApp === 'true' || matchMedia('(display-mode: standalone)').matches) return true;
 try { return sessionStorage.getItem('unomesa-app-mode') === '1'; } catch { return false; }
}
export function initializeAppMode() {
 if (!isAppMode()) return;
 document.documentElement.dataset.unomesaApp = 'true';
 try { sessionStorage.setItem('unomesa-app-mode','1'); } catch {}
}
export function sessionActivityStorage(): Storage { return isAppMode() ? localStorage : sessionStorage; }
export const APP_IDLE_LIMIT = 30 * 24 * 60 * 60 * 1000;

/** Only fixed, same-origin destinations; this hint grants no access. */
export function accountEntryPath() { return isAppMode() ? '/mobile?login=1' : '/login'; }
const googleDestinationKey='unomesa-google-destination';
export function rememberGoogleDestination(){
 try { sessionStorage.setItem(googleDestinationKey,isAppMode()?'app':'web'); } catch {}
}
export function restoreGoogleDestination(){
 let app=isAppMode();
 try { app=app||sessionStorage.getItem(googleDestinationKey)==='app';sessionStorage.removeItem(googleDestinationKey);if(app)sessionStorage.setItem('unomesa-app-mode','1'); } catch {}
 if(app)document.documentElement.dataset.unomesaApp='true';
 return app?'/mobile?login=1':'/login';
}

export function nativeAppMessage(type: 'appReady' | 'appContentReady' | 'appContentPending' | 'tools') {
 const host = window as Window & { webkit?: {messageHandlers?: {unomesa?: {postMessage:(body:{type:string})=>void}}}};
 host.webkit?.messageHandlers?.unomesa?.postMessage({type});
}
