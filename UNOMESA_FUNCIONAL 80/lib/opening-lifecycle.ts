// Presentation only. Access, session expiry and MFA remain owned by MfaSessionGate.
import {nativeAppMessage} from './app-mode';
import {OPENING_EVENT,takeLoginOpening} from './launch-session';
const surface=()=>document.querySelector<HTMLElement>('[data-uno-gated-surface]')?.dataset.unoGatedSurface;
const root=()=>document.documentElement.dataset;
let seen='',busy=true,frame=0,finish=0,started=0;
function paintReady(){root().unomesaContentReady='true';nativeAppMessage('appContentReady')}
function stop(){clearTimeout(finish);delete root().unoOpening}
function hold(){
 clearTimeout(finish);
 if(root().unoOpening!=='hold'){
  root().unoOpening='hold';started=performance.now();
 }
 paintReady();
}
function reveal(){
 if(root().unoOpening!=='hold')return;
 delete root().unomesaEntryPending;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){stop();return}
 const remaining=Math.max(0,300-(performance.now()-started));
 document.documentElement.style.setProperty('--uno-reveal-delay',remaining+'ms');
 root().unoOpening='reveal';finish=window.setTimeout(stop,remaining+950);
}
export function settleOpening(){
 cancelAnimationFrame(frame);
 frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
  if(busy||document.visibilityState==='hidden')return;
  const user=surface();
  delete root().unomesaEntryPending;
  if(!user){stop();paintReady();return}
  const ticket=takeLoginOpening(user);
  if(seen!==user||(ticket&&!root().unoOpening)){seen=user;hold()}
  reveal();paintReady();
 })});
}
export function setOpeningBusy(value:boolean){
 busy=value;
 if(root().unoOpening){paintReady()}else if(value){root().unomesaContentReady='false';nativeAppMessage('appContentPending')}
 settleOpening();
}
export function watchOpenings(){
 // In-memory only: a real relaunch gets a new document and a fresh opening.
 // Leaving this document alive (task switch, sheet, screen lock, BFCache) is not a launch.
 if(root().unoOpening==='hold'){started=performance.now();paintReady()}
 const login=()=>{hold();if(surface())settleOpening()};
 const visible=()=>{
  if(document.visibilityState==='hidden'){if(root().unoOpening==='reveal')stop();return}
  // Complete an interrupted first load; never arm a new opening merely for focus.
  settleOpening();
 };
 const pagehide=()=>{if(root().unoOpening==='reveal')stop()};
 const logout=()=>{seen='';stop()};
 window.addEventListener(OPENING_EVENT,login);window.addEventListener('pagehide',pagehide);
 window.addEventListener('pageshow',settleOpening);
 window.addEventListener('unomesa:session-sign-out',logout);
 document.addEventListener('visibilitychange',visible);
 return ()=>{window.removeEventListener(OPENING_EVENT,login);window.removeEventListener('pagehide',pagehide);
 window.removeEventListener('pageshow',settleOpening);window.removeEventListener('unomesa:session-sign-out',logout);
 document.removeEventListener('visibilitychange',visible);cancelAnimationFrame(frame)};
}
