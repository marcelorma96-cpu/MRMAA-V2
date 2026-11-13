/** One-shot presentation ticket. It never authorizes access and contains no credentials.
 * Only the three explicit, successful sign-in paths issue a ticket. Google may reload the tab. */
const key='unomesa:signed-in-opening:v1';
export const OPENING_EVENT='unomesa:signed-in-opening';
type Ticket={user:string;at:number};
let memory:Ticket|null=null;
export function clearLoginOpening(){
 memory=null;
 if(typeof window!=='undefined')try{window.sessionStorage.removeItem(key)}catch{}
}
export function markLoginOpening(user:string){
 if(typeof window==='undefined'||!user)return;
 memory={user,at:Date.now()};
 try{window.sessionStorage.setItem(key,JSON.stringify(memory))}catch{}
 window.dispatchEvent(new Event(OPENING_EVENT));
}
export function pendingLoginOpening(user:string){
 if(typeof window==='undefined')return false;
 let t=memory;
 try{const s=window.sessionStorage.getItem(key);if(s)t=JSON.parse(s)}catch{}
 const age=t?Date.now()-t.at:Infinity;
 return !!t&&t.user===user&&Number.isFinite(age)&&age>=0&&age<=30*60_000;
}
export function takeLoginOpening(user:string){
 if(!pendingLoginOpening(user))return false;
 clearLoginOpening();return true;
}
