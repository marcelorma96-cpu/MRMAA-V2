import {jsPDF} from 'jspdf';
import {createReservationPdf} from './reservation-pdf';
import {floorPrintReport,type FloorPrintInput} from './floor-print';

async function mapImage(svg:string,signal?:AbortSignal){
 signal?.throwIfAborted();
 const document=new DOMParser().parseFromString(svg,'image/svg+xml'),root=document.documentElement;
 if(root.nodeName!=='svg'||document.querySelector('parsererror'))throw Error('Invalid floor plan');
 const box=(root.getAttribute('viewBox')||'0 0 1000 650').split(/[ ,]+/).map(Number),ratio=box[2]/box[3];
 if(!Number.isFinite(ratio)||ratio<=0)throw Error('Invalid floor bounds');
 const width=Math.round(Math.min(3000,1900*ratio)),height=Math.round(width/ratio);
 root.setAttribute('xmlns','http://www.w3.org/2000/svg');root.setAttribute('width',String(width));root.setAttribute('height',String(height));root.setAttribute('preserveAspectRatio','xMidYMid meet');root.setAttribute('style',`width:${width}px;height:${height}px;--fp-bg:#fff;--fp-text:#182a35;--fp-muted:#5c716a;--fp-line:#abbfb4;color:#182a35`);
 const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='.overviewRoom{fill:transparent;stroke:#abbfb4;stroke-width:2}.overviewRoom.solid{fill:#fff}.overviewRoom.borderless{stroke:transparent}.overviewRoom.full{stroke:#6a89b7}text{font-family:Arial,sans-serif}';root.prepend(style);
 // A self-contained data URL avoids Safari's inconsistent Blob-SVG decoding.
 const xml=new XMLSerializer().serializeToString(root),source='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);
 const img=new Image();
 await new Promise<void>((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);img.onload=null;img.onerror=null};
  const abort=()=>{cleanup();img.src='';reject(new DOMException('Aborted','AbortError'))};
  const timer=setTimeout(()=>{cleanup();img.src='';reject(Error('FLOOR_IMAGE_TIMEOUT'))},15000);
  img.onload=()=>{cleanup();resolve()};img.onerror=()=>{cleanup();reject(Error('FLOOR_IMAGE_DECODE'))};signal?.addEventListener('abort',abort,{once:true});img.src=source;
 });
 signal?.throwIfAborted();const canvas=window.document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('FLOOR_IMAGE_CANVAS');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);const png=canvas.toDataURL('image/png');canvas.width=canvas.height=1;return {png,ratio};
}
/** PDF and Print consume one report; table pagination retains every row and long note. */
export async function createFloorPdf(input:FloorPrintInput,signal?:AbortSignal){
 const {mode,en,restaurant,date,demo}=input,maps=input.maps||[input.map],say=(es:string,eng:string)=>en?eng:es,report=floorPrintReport(input);
 signal?.throwIfAborted();
 const pdf=mode==='map'?new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true}):createReservationPdf(report);
 if(mode==='map'||mode==='both')for(let index=0;index<maps.length;index++){
  const map=maps[index],rendered=await mapImage(map.svg,signal);if(mode==='both')pdf.insertPage(index+1);else if(index)pdf.addPage('a4','landscape');pdf.setPage(index+1);pdf.setTextColor('#182a35');pdf.setFont('helvetica','bold');pdf.setFontSize(16);
  const names=pdf.splitTextToSize(restaurant,273);pdf.text(names,12,16);let y=16+names.length*6;pdf.setFontSize(11);pdf.text(say('Plano de mesas','Floor plan'),12,y);y+=6;pdf.setFont('helvetica','normal');pdf.setFontSize(9);
  const context=pdf.splitTextToSize(`${date} - ${map.title} - ${map.windowLabel||''}${demo?' - DEMO':''}`,273);pdf.text(context,12,y);y+=context.length*4+4;
  if(y>90)throw Error(say('Acorte el nombre del restaurante para este PDF.','Shorten the restaurant name for this PDF.'));
  const available=183-y,w=Math.min(273,available*rendered.ratio),h=w/rendered.ratio;
  pdf.addImage(rendered.png,'PNG',12+(273-w)/2,y+(available-h)/2,w,h,undefined,'FAST');
  pdf.setFontSize(8);pdf.setTextColor('#52675f');pdf.text(say('Verde: disponible | Azul: reservada | Naranja: en mesa | Rojo: revisar','Green: available | Blue: reserved | Orange: seated | Red: review'),12,188);
  const legend=say('p = personas; +as. = asientos adicionales; g = grupo. Las reservas del día aparecen en cada mesa.','p = people; +s = added seats; g = group. Day reservations appear on each table.');pdf.text(pdf.splitTextToSize(legend,273),12,193);
 }
 if(mode!=='map'&&!report.rows.length){pdf.setPage(mode==='both'?maps.length+1:1);pdf.setFontSize(10);pdf.setTextColor('#52675f');pdf.text(say('No hay reservaciones para esta selección.','No reservations for this selection.'),12,75);}
 const pages=pdf.getNumberOfPages();for(let n=1;n<=pages;n++){pdf.setPage(n);pdf.setFillColor('#fff');pdf.rect(240,199,47,8,'F');pdf.setTextColor('#71717a');pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.text(`${say('Página','Page')} ${n} / ${pages}`,285,204,{align:'right'});}
 pdf.setProperties({title:report.title,subject:report.context,creator:'UnoMesa'});signal?.throwIfAborted();return pdf;
}
