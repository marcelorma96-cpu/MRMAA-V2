// Sheets and dialogs share one visual order, including dialogs opened from a sheet.
type Layer={element:HTMLElement;inert:boolean;zIndex:string};
const layers:Layer[]=[];
let restoreScroll:(()=>void)|undefined;
function arrange(){layers.forEach(({element},index)=>{element.style.zIndex=String(100+index);element.inert=index!==layers.length-1})}
export function registerOverlay(element:HTMLElement){
 if(!layers.length){
  const root=document.documentElement,overflow=root.style.overflow,padding=root.style.paddingRight;
  const gap=window.innerWidth-root.clientWidth;
  // Keep the page in place while a dialog is open, including nested confirmations.
  // Stable gutters avoid a horizontal jump when the scrollbar disappears.
  const style=getComputedStyle(root);
  if(gap>0&&!(style.scrollbarGutter||'').includes('stable'))root.style.paddingRight=`${parseFloat(style.paddingRight||'0')+gap}px`;
  root.style.overflow='hidden';
  restoreScroll=()=>{root.style.overflow=overflow;root.style.paddingRight=padding};
 }
 const layer={element,inert:element.inert,zIndex:element.style.zIndex};
 layers.push(layer);arrange();
 return()=>{const index=layers.indexOf(layer);if(index<0)return;layers.splice(index,1);element.inert=layer.inert;element.style.zIndex=layer.zIndex;arrange();if(!layers.length){restoreScroll?.();restoreScroll=undefined}};
}
export function isTopOverlay(element:HTMLElement|null){return !!element&&layers.at(-1)?.element===element}
