'use client';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
import {pdfBookSpread,pdfSwipeDirection} from '@/lib/pdf-book';
import {ContactLink} from './contact-link';
import s from './public-pdf-viewer.module.css';

function PdfPage({pdf,number,width,height,en}:{pdf:PDFDocumentProxy;number:number;width:number;height:number;en:boolean}){
 const host=useRef<HTMLDivElement>(null);
 const [ratio,setRatio]=useState(1/Math.SQRT2),[ready,setReady]=useState(false),[error,setError]=useState(false),[text,setText]=useState('');
 const fittedWidth=Math.min(width,height*ratio);
 useEffect(()=>{
  setReady(false);setError(false);
  let disposed=false,render:RenderTask|undefined;const container=host.current;
  void (async()=>{
   try{
    const page=await pdf.getPage(number);if(disposed)return;
    const natural=page.getViewport({scale:1}),aspect=natural.width/natural.height;setRatio(aspect);
    const viewport=page.getViewport({scale:Math.min(width,height*aspect)/natural.width});
    // Only the visible spread is rendered; each canvas is bounded to 6M pixels.
    const density=Math.min(window.devicePixelRatio||1,2,Math.sqrt(6000000/(viewport.width*viewport.height)));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(viewport.width*density));canvas.height=Math.max(1,Math.ceil(viewport.height*density));
    canvas.style.width='100%';canvas.style.height='100%';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',(en?'Page':'Página')+' '+number);
    render=page.render({canvas,viewport,transform:[density,0,0,density,0,0],background:'#ffffff'});
    await render.promise;if(disposed)return;
    container?.replaceChildren(canvas);setReady(true);
    const content=await page.getTextContent();if(!disposed)setText(content.items.map(item=>'str' in item?item.str:'').join(' '));
   }catch(e){if(!disposed&&(e as Error).name!=='RenderingCancelledException')setError(true);}
  })();
  return()=>{disposed=true;render?.cancel();container?.replaceChildren();};
 },[pdf,number,width,height,en]);
 return <section className={s.page} aria-label={(en?'Page':'Página')+' '+number} style={{width:fittedWidth}}>
  <div className={s.paper} style={{aspectRatio:ratio}}>
   <div ref={host} className={s.canvas}/>
   {!ready&&<div className={s.pagePlaceholder} role={error?'alert':undefined}>{error?(en?'This page could not be displayed. Use Open file.':'No se pudo mostrar esta página. Use Abrir archivo.'):(en?'Page':'Página')+' '+number}</div>}
  </div>
  {text&&<p className={s.srOnly}>{text}</p>}
 </section>;
}

/** Loaded on request. Render a spread instead of mounting an entire PDF. */
export function PublicPdfViewer({href,name,en}:{href:string;name:string;en:boolean}){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[zoom,setZoom]=useState(1),[size,setSize]=useState({width:300,height:400}),[index,setIndex]=useState(0),[direction,setDirection]=useState(1);
 const viewport=useRef<HTMLDivElement>(null),touch=useRef<{x:number;y:number;at:number}|null>(null),t=(es:string,eng:string)=>en?eng:es;
 const spread=pdfBookSpread(pdf?.numPages||0,index,size.width);
 const pageWidth=Math.max(80,(size.width-32-(spread.columns-1)*10)/spread.columns),pageHeight=Math.max(80,size.height-32);
 function turn(delta:number){if(!pdf||(delta<0&&!spread.previous)||(delta>0&&!spread.next))return;setDirection(delta);setIndex(Math.max(0,spread.start+delta*spread.columns));setZoom(1);}
 useEffect(()=>{
  let disposed=false,task:ReturnType<typeof import('pdfjs-dist')['getDocument']>|undefined;
  setPdf(null);setError('');setZoom(1);setIndex(0);
  const timer=setTimeout(()=>{if(!disposed){setError(en?'The PDF took too long to load. Try again.':'El PDF tardó demasiado en cargar. Vuelva a intentar.');void task?.destroy();}},30000);
  void (async()=>{
   try{
    const lib=await import('pdfjs-dist/legacy/build/pdf.mjs');if(disposed)return;
    const base='/pdfjs/'+lib.version+'/';lib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';
    task=lib.getDocument({url:href,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',enableXfa:false});
    const document=await task.promise;if(disposed)return;
    clearTimeout(timer);setError('');setPdf(document);
   }catch{if(!disposed){clearTimeout(timer);setError(en?'Could not load this PDF. Try again or open the file.':'No se pudo cargar este PDF. Reintente o abra el archivo.');}}
  })();
  return()=>{disposed=true;clearTimeout(timer);void task?.destroy();};
 },[href,attempt,en]);
 useEffect(()=>{
  const element=viewport.current;if(!element)return;
  const resize=()=>setSize({width:element.clientWidth,height:element.clientHeight});
  resize();const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{viewport.current?.scrollTo(0,0)},[spread.start,href,zoom===1]);
 const range=spread.pages.length>1?spread.pages[0]+'–'+spread.pages[spread.pages.length-1]:String(spread.pages[0]||1);
 return <div className={s.viewer} aria-label={t('Visor del menú PDF','PDF menu viewer')}>
  <div className={s.toolbar}>
   <span>{t('Menú PDF','PDF menu')}</span>
   <div className={s.controls}><button type="button" aria-label={t('Alejar PDF','Zoom out PDF')} disabled={!pdf||zoom<=1} onClick={()=>setZoom(x=>Math.max(1,x-.25))}>−</button><button type="button" disabled={!pdf} onClick={()=>setZoom(1)}>{zoom===1?t('Ajustar','Fit'):Math.round(zoom*100)+'%'}</button><button type="button" aria-label={t('Acercar PDF','Zoom in PDF')} disabled={!pdf||zoom>=3} onClick={()=>setZoom(x=>Math.min(3,x+.25))}>+</button></div>
   <ContactLink href={href} className={s.open}>{t('Abrir archivo','Open file')} ↗</ContactLink>
  </div>
  <div ref={viewport} className={s.viewport} aria-label={name} tabIndex={0} style={{touchAction:zoom===1?'pan-y pinch-zoom':'pan-x pan-y pinch-zoom'}} onKeyDown={e=>{if(e.target!==e.currentTarget||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();turn(e.key==='ArrowLeft'?-1:1)}}} onTouchStart={e=>{touch.current=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,at:Date.now()}:null}} onTouchMove={e=>{if(e.touches.length!==1)touch.current=null}} onTouchCancel={()=>{touch.current=null}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start||e.touches.length||!e.changedTouches[0])return;const end=e.changedTouches[0],delta=pdfSwipeDirection(end.clientX-start.x,end.clientY-start.y,Date.now()-start.at,zoom*(window.visualViewport?.scale||1));if(delta)turn(delta)}}>
   {!pdf&&!error&&<div className={s.message} role="status"><span className={s.spinner}/>{t('Cargando menú…','Loading menu…')}</div>}
   {error?<div className={s.message} role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(x=>x+1)}>{t('Reintentar','Retry')}</button></div>:pdf&&<div key={spread.start} className={s.spread+' '+(direction>0?s.forward:s.backward)} style={{minWidth:zoom>1?size.width*zoom:undefined,minHeight:zoom>1?size.height*zoom:undefined}}>{spread.pages.map(number=><PdfPage key={number} pdf={pdf} number={number} width={pageWidth*zoom} height={pageHeight*zoom} en={en}/>)}</div>}
  </div>
  <nav className={s.navigation} aria-label={t('Páginas del menú','Menu pages')}><button type="button" disabled={!pdf||!spread.previous} onClick={()=>turn(-1)} aria-label={t('Páginas anteriores','Previous pages')}>← <span>{t('Anterior','Previous')}</span></button><span className={s.counter} role="status" aria-live="polite">{pdf?(spread.pages.length>1?t('Páginas','Pages'):t('Página','Page'))+' '+range+' / '+pdf.numPages:'—'}</span><button type="button" disabled={!pdf||!spread.next} onClick={()=>turn(1)} aria-label={t('Páginas siguientes','Next pages')}><span>{t('Siguiente','Next')}</span> →</button></nav>
  <p className={s.hint}>{zoom===1?t('Deslice o use las flechas para pasar de página.','Swipe or use the arrows to turn pages.'):t('Mueva la página para leerla. Pulse Ajustar para verla completa.','Pan to read. Tap Fit to see the full page.')}</p>
 </div>;
}
