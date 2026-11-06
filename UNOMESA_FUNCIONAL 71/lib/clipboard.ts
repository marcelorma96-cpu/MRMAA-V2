/** Copy only after a user action. A denied/unavailable Clipboard API falls back
 * to selection-based copying for embedded browsers. Never report false success. */
export async function copyText(value:string):Promise<boolean>{
 if(!value)return false;
 try{
  if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){
   await navigator.clipboard.writeText(value);return true;
  }
 }catch{/* Try the selection-based path used by older webviews. */}
 if(typeof document==='undefined'||!document.body)return false;
 const previous=document.activeElement as HTMLElement|null;
 const selection=document.getSelection(),ranges:Range[]=[];
 if(selection)for(let i=0;i<selection.rangeCount;i++)ranges.push(selection.getRangeAt(i).cloneRange());
 const field=document.createElement('textarea');
 field.value=value;field.readOnly=true;field.tabIndex=-1;
 field.style.cssText='position:fixed;top:0;left:-9999px;width:1px;height:1px;font-size:16px;';
 try{
  document.body.appendChild(field);field.focus({preventScroll:true});field.select();field.setSelectionRange(0,value.length);
  return document.execCommand('copy')===true;
 }catch{return false;}
 finally{
  field.remove();previous?.focus?.({preventScroll:true});
  if(selection){selection.removeAllRanges();for(const range of ranges)selection.addRange(range);}
 }
}
