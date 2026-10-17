// Sheets and dialogs share one visual order, including dialogs opened from a sheet.
type Layer={element:HTMLElement;inert:boolean;zIndex:string};
const layers:Layer[]=[];
function arrange(){layers.forEach(({element},index)=>{element.style.zIndex=String(100+index);element.inert=index!==layers.length-1})}
export function registerOverlay(element:HTMLElement){
 const layer={element,inert:element.inert,zIndex:element.style.zIndex};
 layers.push(layer);arrange();
 return()=>{const index=layers.indexOf(layer);if(index<0)return;layers.splice(index,1);element.inert=layer.inert;element.style.zIndex=layer.zIndex;arrange()};
}
export function isTopOverlay(element:HTMLElement|null){return !!element&&layers.at(-1)?.element===element}
