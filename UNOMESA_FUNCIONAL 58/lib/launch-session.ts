/** Presentation state only: never grants access or skips an authentication gate. */
const key='unomesa-launch-complete';
type LaunchWindow=Window & {__unomesaLaunchSession?:string;__unomesaLaunchFinished?:boolean};
export function launchCompleted(){
 if(typeof window==='undefined')return false;
 const w=window as LaunchWindow;
 if(document.documentElement.dataset.unomesaLaunchComplete==='true'||w.__unomesaLaunchFinished)return true;
 try{return sessionStorage.getItem(key)===(w.__unomesaLaunchSession||'tab')}catch{return false}
}
export function completeLaunch(){
 if(typeof window==='undefined')return;
 (window as LaunchWindow).__unomesaLaunchFinished=true;
 document.documentElement.dataset.unomesaLaunchComplete='true';
 try{sessionStorage.setItem(key,(window as LaunchWindow).__unomesaLaunchSession||'tab')}catch{}
}
