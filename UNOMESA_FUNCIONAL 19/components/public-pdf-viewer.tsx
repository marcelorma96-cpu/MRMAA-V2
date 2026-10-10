'use client';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy,PDFPageProxy,RenderTask} from 'pdfjs-dist';
import {ContactLink} from './contact-link';
import s from './public-pdf-viewer.module.css';

function PdfPage({pdf,number,width,en}:{pdf:PDFDocumentProxy;number:number;width:number;en:boolean}){
 const frame=useRef<HTMLDivElement>(null),host=useRef<HTMLDivElement>(null);
 const [near,setNear]=useState(number===1),[ratio,setRatio]=useState(1/Math.SQRT2),[ready,setReady]=useState(false),[error,setError]=useState(false),[text,setText]=useState('');
 useEffect(()=>{
  const element=frame.current;if(!element)return;
  const observer=new IntersectionObserver(([entry])=>setNear(entry.isIntersecting),{rootMargin:'450px 0px'});
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  setReady(false);setError(false);
  if(!near||width<1)return;
  let disposed=false,render:RenderTask|undefined,page:PDFPageProxy|undefined;
  const container=host.current;
  void (async()=>{
   try{
    page=await pdf.getPage(number);if(disposed)return;
    const natural=page.getViewport({scale:1});setRatio(natural.width/natural.height);
    const viewport=page.getViewport({scale:width/natural.width});
    // Bound canvas memory on mobile, including oversized pages at high zoom.
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
 },[pdf,number,width,near,en]);
 return <section className={s.page} aria-label={(en?'Page':'Página')+' '+number} style={{width}}>
  <div ref={frame} className={s.paper} style={{aspectRatio:ratio}}>
   <div ref={host} className={s.canvas}/>
   {!ready&&<div className={s.pagePlaceholder} role={error?'alert':undefined}>{error?(en?'This page could not be displayed. Use Open file.':'No se pudo mostrar esta página. Use Abrir archivo.'):(en?'Page':'Página')+' '+number}</div>}
  </div>
  <p className={s.pageNumber}>{en?'Page':'Página'} {number} / {pdf.numPages}</p>
  {text&&<p className={s.srOnly}>{text}</p>}
 </section>;
}

/** Opens only on request; canvas rendering needs neither a PDF plug-in nor a popup. */
export function PublicPdfViewer({href,name,en}:{href:string;name:string;en:boolean}){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[zoom,setZoom]=useState(1),[width,setWidth]=useState(300);
 const viewport=useRef<HTMLDivElement>(null),t=(es:string,eng:string)=>en?eng:es;
 useEffect(()=>{
  let disposed=false,task:ReturnType<typeof import('pdfjs-dist')['getDocument']>|undefined;
  setPdf(null);setError('');setZoom(1);
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
  const resize=()=>setWidth(Math.max(180,Math.min(1000,element.clientWidth-24)));
  resize();const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();
 },[]);
 return <div className={s.viewer} aria-label={t('Visor del menú PDF','PDF menu viewer')}>
  <div className={s.toolbar}>
   <span role="status">{pdf?pdf.numPages+' '+t('páginas','pages'):t('Menú PDF','PDF menu')}</span>
   <div className={s.controls}><button type="button" aria-label={t('Alejar PDF','Zoom out PDF')} disabled={!pdf||zoom<=1} onClick={()=>setZoom(x=>Math.max(1,x-.25))}>−</button><button type="button" disabled={!pdf} onClick={()=>setZoom(1)}>{zoom===1?t('Ajustar','Fit'):Math.round(zoom*100)+'%'}</button><button type="button" aria-label={t('Acercar PDF','Zoom in PDF')} disabled={!pdf||zoom>=3} onClick={()=>setZoom(x=>Math.min(3,x+.25))}>+</button></div>
   <ContactLink href={href} className={s.open}>{t('Abrir archivo','Open file')} ↗</ContactLink>
  </div>
  <div ref={viewport} className={s.viewport} aria-label={name} tabIndex={0}>
   {!pdf&&!error&&<div className={s.message} role="status"><span className={s.spinner}/>{t('Cargando menú…','Loading menu…')}</div>}
   {error?<div className={s.message} role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(x=>x+1)}>{t('Reintentar','Retry')}</button></div>:pdf&&<div className={s.pages} style={{minWidth:width*zoom+24}}>{Array.from({length:pdf.numPages},(_,i)=><PdfPage key={i} pdf={pdf} number={i+1} width={width*zoom} en={en}/>)}</div>}
  </div>
 </div>;
}
