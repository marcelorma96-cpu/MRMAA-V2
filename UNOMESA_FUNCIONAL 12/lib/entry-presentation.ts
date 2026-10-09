/** Early presentation hint only. Credentials are still checked by all existing gates. */
export const ENTRY_PRESENTATION_SCRIPT = `(()=>{try{
 if(location.pathname==='/login'){document.documentElement.dataset.unomesaEntryPending='true';return;}
 if(!['/','/es','/mobile'].includes(location.pathname))return;
 const p=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1));
 let privateEntry=['login','signup','code','reset','invite','invitation','support','billing','error'].some(k=>p.has(k))||['access_token','refresh_token','type','error'].some(k=>h.has(k));
 const app=/UnoMesa-(iOS|Android)\\//.test(navigator.userAgent)||location.pathname==='/mobile'||sessionStorage.getItem('unomesa-app-mode')==='1';
 const storage=app?localStorage:sessionStorage;
 for(let i=0;i<storage.length&&!privateEntry;i++){const k=storage.key(i);if(k&&/^(unomesa-app:)?sb-.+-auth-token$/.test(k)){try{const v=JSON.parse(storage.getItem(k)||'null');privateEntry=!!v?.access_token}catch{}}}
 if(privateEntry||app)document.documentElement.dataset.unomesaEntryPending='true';
}catch{}})();`;
