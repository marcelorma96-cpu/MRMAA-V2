export const branchKey=(userId:string)=>`unomesa:${userId}:active-branch`;
export function rememberedBranch(userId:string) {try{return localStorage.getItem(branchKey(userId))||undefined;}catch{return undefined;}}
export function rememberBranch(userId:string,id:string){try{localStorage.setItem(branchKey(userId),id);}catch{/* private storage */}}
export function branchPrice(count:number){if(!Number.isSafeInteger(count)||count<1||count>10000)throw new Error('BRANCH_COUNT');return (count===1?55:count*45)*100;}
export function branchCount(value:unknown){const n=value===undefined?1:value;if(typeof n!=='number'||!Number.isSafeInteger(n)||n<1||n>10000)throw new Error('BRANCH_COUNT');return n;}
