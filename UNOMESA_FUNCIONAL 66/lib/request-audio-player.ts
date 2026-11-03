import {requestAlertSettings,requestAlertWav} from './request-alert';
export type RequestAudioStatus='idle'|'starting'|'playing'|'blocked'|'paused'|'error';
type Config=ReturnType<typeof requestAlertSettings>;
/** One media element per restaurant notice; play() is called synchronously
 * from click handlers to preserve Safari's user-activation permission. */
export class RequestAudioPlayer {
 private audio:HTMLAudioElement;
 private config:Config=requestAlertSettings(undefined);
 private pending=false;
 private mode:'alert'|'test'='alert';
 private url='';private signature='';private generation=0;private disposed=false;
 private status:RequestAudioStatus='idle';
 private watchdog:ReturnType<typeof setInterval>;
 private lastTime=-1;private stalled=0;private authorized=false;
 private listeners:Record<string,()=>void>;
 constructor(private report:(status:RequestAudioStatus)=>void) {
   this.audio=document.createElement('audio');this.audio.preload='auto';
   this.audio.setAttribute('playsinline','');this.audio.setAttribute('aria-hidden','true');
   this.audio.hidden=true;document.body.appendChild(this.audio);
   this.listeners={
     playing:()=>{this.authorized=true;this.stalled=0;this.emit('playing')},
     pause:()=>{if(this.wanted())this.emit('paused')},
     error:()=>this.emit('error'),
     ended:()=>{if(this.mode==='test'){this.mode='alert';if(this.wanted())this.play();else this.stop()}},
   };
   Object.entries(this.listeners).forEach(([name,fn])=>this.audio.addEventListener(name,fn));
   this.watchdog=setInterval(()=>{
     if(!this.wanted()||document.hidden)return;
     if(this.status==='starting'){if(++this.stalled>=4)this.emit('error');return}
     if(this.status!=='playing')return;
     // Never claim active audio when the media clock has stopped advancing.
     if(this.audio.paused){this.emit('paused');return}
     if(this.lastTime===this.audio.currentTime){if(++this.stalled>=2)this.emit('paused')}
     else{this.lastTime=this.audio.currentTime;this.stalled=0}
   },2000);
 }
 private emit(status:RequestAudioStatus){if(this.disposed)return;this.status=status;this.report(status)}
 private wanted(){return !this.disposed&&!document.hidden&&((this.mode==='test')||(this.pending&&this.config.enabled&&this.config.volume>0))}
 configure(pending:boolean,settings:unknown){
   const next=requestAlertSettings(settings),changed=JSON.stringify(next)!==JSON.stringify(this.config);
   const wasPending=this.pending;this.pending=pending;this.config=next;
   if(this.mode==='test')return;
   if(!this.wanted()){this.stop();return}
   if(changed||!wasPending||this.status==='idle')this.play(changed||!wasPending);
 }
 gesture(){if(this.wanted()&&this.status!=='playing'&&this.status!=='starting')this.play()}
 activate(){if(this.wanted())this.play(true)}
 test(settings:unknown){
   const testConfig=requestAlertSettings(settings);
   if(testConfig.volume===0){this.emit('idle');return}
   this.mode='test';this.play(true,testConfig);
 }
 visibility(){
   if(document.hidden){this.mode='alert';this.stop();return}
   if(this.wanted()&&this.authorized)this.play();
 }
 private play(restart=false,override?:Config){
   if(!this.wanted())return;
   const config=override||this.config;
   const signature=`${this.mode}:${config.interval}:${config.volume}`;
   if(!restart&&signature===this.signature&&!this.audio.paused&&this.status==='playing')return;
   const generation=++this.generation;this.emit('starting');this.stalled=0;this.lastTime=-1;
   try{
     if(signature!==this.signature){
       this.audio.pause();if(this.url)URL.revokeObjectURL(this.url);
       this.url=URL.createObjectURL(new Blob([requestAlertWav(this.mode==='test'?1:config.interval,config.volume)],{type:'audio/wav'}));
       this.audio.src=this.url;this.audio.loop=this.mode==='alert';this.signature=signature;
     }
     if(restart)this.audio.currentTime=0;
     // No await, timer, or React effect between user click and this call.
     const result=this.audio.play();
     void result.then(()=>{
       if(generation!==this.generation||this.disposed)return;
       this.authorized=true;
       if(!this.audio.paused)this.emit('playing');
     }).catch((error:unknown)=>{
       if(generation!==this.generation||this.disposed)return;
       const name=error&&typeof error==='object'&&'name' in error?error.name:'';
       this.emit(name==='NotAllowedError'?'blocked':'error');
     });
   }catch{this.emit('error')}
 }
 stop(){this.generation++;this.audio.pause();this.emit('idle')}
 dispose(){
   this.disposed=true;this.generation++;clearInterval(this.watchdog);
   Object.entries(this.listeners).forEach(([name,fn])=>this.audio.removeEventListener(name,fn));
   this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio.remove();
   if(this.url)URL.revokeObjectURL(this.url);
 }
}
