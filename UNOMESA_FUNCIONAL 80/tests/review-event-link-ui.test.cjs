// Exercises the actual React components and handlers with isolated RPCs and a small in-memory DOM.
const {createRequire}=require('module'),path=require('path'),req=createRequire(path.resolve('package.json')),esb=req('esbuild'),assert=require('node:assert/strict');
const fixture={
 "./dashboard-ui":'import React from "react"; export const Modal=({children,title,close})=><div role="dialog"><h2>{title}</h2><button onClick={close}>Cerrar</button>{children}</div>',
 "./app-preferences":'export const useAppPreferences=()=>({language:"es",t:x=>x}); export const formatAppMoney=x=>"Q"+x',
 "./restaurant-sync":'export const useDataRefresh=()=>0',
 "@/lib/floor-sync":'export const notifyFloorChange=()=>{}',
 "@/lib/quote-data":'export const readAvailableReservationPage=async()=>({rows:[window.r]})',
 "@/lib/event-linking":'export const readLinkableQuotePage=async()=>({rows:[window.q]});export const eventLinkError=e=>e.message',
 "@/lib/supabase":'export const supabase={rpc:async(n,args)=>{window.calls.push(args);return {data:args.p_expected?{linked:true}:{token:"reviewed-pair",before:{guests:18,area:"Patio",deposit:125},after:{guests:25,area:"Terraza",deposit:100}},error:null}}}'
};
require('node:test').test('both rendered pickers preview the correct pair, cancel without a write, and commit only the displayed review',async()=>{const b=await esb.build({bundle:true,write:false,jsx:'automatic',loader:{'.tsx':'tsx'},stdin:{contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ReservationQuoteLink,QuoteReservationLink} from './components/reservation-quote-link';
window.q={id:'Q',client_name:'Prueba',quote_number:20,event_date:'2026-01-01',area:'Terraza',status:'pendiente',total:150};window.r={id:'R',client_name:'Prueba',event_date:'2026-01-01',area:'Patio',guests:18,status:'confirmada'};window.calls=[];
function App(){const [mode,setMode]=useState('');const props={restaurantId:'T',close:()=>setMode(''),linked:()=>setMode('')};return <><button onClick={()=>setMode('r')}>desde reserva</button><button onClick={()=>setMode('q')}>desde cotización</button>{mode==='r'?<ReservationQuoteLink reservation={window.r} {...props}/>:mode==='q'?<QuoteReservationLink quote={window.q} {...props}/>:null}</>}
createRoot(document.querySelector('#root')).render(<App/>);`,loader:'tsx',resolveDir:process.cwd()},plugins:[{name:'isolated-data',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(fixture,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fixture[a.path],loader:'tsx',resolveDir:process.cwd()}))}}]});
const vm=require('vm');
class Node {
 constructor(type,name,doc){this.nodeType=type;this.nodeName=name;this.tagName=name;this.ownerDocument=doc;this.childNodes=[];this.attributes={};this.style={};this.namespaceURI='http://www.w3.org/1999/xhtml';this._text='';}
 appendChild(c){if(c.parentNode)c.parentNode.removeChild(c);this.childNodes.push(c);c.parentNode=this;return c}
 insertBefore(c,b){if(c.parentNode)c.parentNode.removeChild(c);const i=this.childNodes.indexOf(b);this.childNodes.splice(i<0?this.childNodes.length:i,0,c);c.parentNode=this;return c}
 removeChild(c){this.childNodes.splice(this.childNodes.indexOf(c),1);c.parentNode=null;return c}
 get firstChild(){return this.childNodes[0]||null}get lastChild(){return this.childNodes.at(-1)||null}
 set textContent(t){this._text=String(t);this.childNodes=[]}get textContent(){return this.nodeType===3?this.nodeValue:this._text+this.childNodes.map(n=>n.textContent).join('')}
 setAttribute(k,v){this.attributes[k]=String(v)}getAttribute(k){return this.attributes[k]||null}removeAttribute(k){delete this.attributes[k]}
 addEventListener(){}removeEventListener(){}focus(){}
}
const doc=new Node(9,'#document',null);doc.createElement=n=>new Node(1,n.toUpperCase(),doc);doc.createElementNS=(ns,n)=>doc.createElement(n);
doc.createTextNode=t=>Object.assign(new Node(3,'#text',doc),{nodeValue:t});
doc.documentElement=doc.createElement('html');doc.body=doc.createElement('body');doc.activeElement=doc.body;const root=doc.createElement('div');doc.body.appendChild(root);doc.querySelector=()=>root;
const window={document:doc,HTMLElement:Node,HTMLIFrameElement:class{},addEventListener(){},removeEventListener(){},location:{protocol:'http:'},setTimeout,clearTimeout};doc.defaultView=window;
vm.runInNewContext(b.outputFiles[0].text,{window,document:doc,navigator:{userAgent:'test'},console,setTimeout,clearTimeout,queueMicrotask,AbortController,performance,process:{env:{NODE_ENV:'test'}}});
const sleep=()=>new Promise(r=>setTimeout(r,12));
function flat(n){return [n,...n.childNodes.flatMap(flat)]}
const props=n=>n[Object.keys(n).find(k=>k.startsWith('__reactProps$'))];
async function wait(fn){for(let i=0;i<120;i++){const v=fn();if(v)return v;await sleep()}throw Error('Timeout: '+root.textContent)}
async function click(label){const n=await wait(()=>flat(root).find(n=>n.tagName==='BUTTON'&&n.textContent===label&&!n.disabled));props(n).onClick({preventDefault(){}});await sleep()}
async function choose(){const n=await wait(()=>flat(root).find(n=>n.tagName==='INPUT'&&props(n)?.type==='radio'));props(n).onChange({});await sleep()}
for(const name of ['desde reserva','desde cotización']){window.calls=[];
 await click(name);await choose();assert(!root.textContent.includes('Confirmar vínculo'));await click('Revisar vínculo');await wait(()=>root.textContent.includes('Confirmar vínculo'));const cells=flat(root).filter(n=>n.tagName==='TD').map(n=>n.textContent);for(const v of ['18','25','Patio','Terraza'])assert(cells.includes(v));
 await click('Cerrar');assert.deepEqual(Array.from(window.calls,c=>c.p_expected),[null]);
 await click(name);await choose();await click('Revisar vínculo');await click('Confirmar vínculo');await wait(()=>!flat(root).some(n=>n.attributes.role==='dialog'));
 assert.deepEqual(Array.from(window.calls,c=>[c.p_reservation,c.p_quote,c.p_expected]),[['R','Q',null],['R','Q',null],['R','Q','reviewed-pair']]);console.log(name+': selección, comparación, cancelar y confirmar OK');
}
});
