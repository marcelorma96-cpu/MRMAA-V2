import {jsPDF} from 'jspdf';
import type {ReservationReport} from './reservation-report';

/** Text-based A4 report with repeated headers and lossless long-row pagination. */
export function createReservationPdf(report:ReservationReport){
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 pdf.setProperties({title:report.title,subject:report.context,creator:'UnoMesa'});
 const margin=12,width=273,bottom=196,font=8.5,line=3.8,padding=4;
 const weight=report.columns.reduce((n,c)=>n+c.weight,0),widths=report.columns.map(c=>width*c.weight/weight);
 const wrap=(text:string,w:number)=>pdf.splitTextToSize(text||' ',w) as string[];
 let y=0,tableTop=0;
 const header=()=>{
  pdf.setTextColor('#18181b');pdf.setFont('helvetica','bold');pdf.setFontSize(16);
  const name=wrap(report.restaurant,width);pdf.text(name,margin,16);y=16+name.length*6;
  pdf.setFontSize(11);pdf.text(report.title,margin,y);y+=6;
  pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);
  const context=wrap(report.context,width);pdf.text(context,margin,y,{lineHeightFactor:1.2});y+=context.length*3.8+2;
  pdf.setTextColor('#71717a');pdf.text(report.generated,margin,y);y+=7;
  if(y>90)throw new Error(report.language==='en'?'Shorten the restaurant name or search text for this report.':'Acorte el nombre del restaurante o el texto de búsqueda para este reporte.');
 };
 const tableHeader=()=>{
  pdf.setFont('helvetica','bold');pdf.setFontSize(font);
  const titles=report.columns.map((c,i)=>wrap(c.label,widths[i]-4)),height=Math.max(...titles.map(a=>a.length))*line+padding;
  pdf.setFillColor('#18181b');pdf.rect(margin,y,width,height,'F');pdf.setTextColor('#ffffff');
  let x=margin;titles.forEach((text,i)=>{pdf.text(text,x+2,y+4.5,{lineHeightFactor:line/(font*.352778)});x+=widths[i]});y+=height;tableTop=y;
 };
 const nextPage=()=>{pdf.addPage('a4','landscape');header();tableHeader()};
 header();
 if(report.mode!=='reservations'){
  const gap=5,w=(width-gap*(report.metrics.length-1))/Math.max(1,report.metrics.length);
  report.metrics.forEach((m,i)=>{const x=margin+i*(w+gap);pdf.setDrawColor('#d4d4d8');pdf.setFillColor('#fafafa');pdf.roundedRect(x,y,w,22,2,2,'FD');pdf.setTextColor('#18181b');pdf.setFont('helvetica','bold');pdf.setFontSize(14);pdf.text(m.value,x+5,y+9);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.text(m.label,x+5,y+16)});y+=29;
 }
 if(report.mode!=='summary'){
  tableHeader();
  report.rows.forEach((row,index)=>{
   if(row.length!==widths.length)throw new Error('Invalid reservation report columns');
   pdf.setFont('helvetica','normal');pdf.setFontSize(font);
   const cells=row.map((cell,i)=>wrap(cell,widths[i]-4)),lines=Math.max(1,...cells.map(c=>c.length));
   if(y+Math.max(10,lines*line+padding)>bottom&&y>tableTop)nextPage();
   let offset=0;
   while(offset<lines){
    const available=Math.floor((bottom-y-padding)/line);
    if(available<1||y+10>bottom){nextPage();continue;}
    const count=Math.min(lines-offset,available),height=Math.max(10,count*line+padding);
    pdf.setFillColor(index%2?'#f7f7f8':'#ffffff');pdf.rect(margin,y,width,height,'F');pdf.setDrawColor('#dedee3');pdf.line(margin,y+height,margin+width,y+height);
    pdf.setTextColor('#18181b');pdf.setFont('helvetica','normal');pdf.setFontSize(font);let x=margin;
    cells.forEach((cell,i)=>{const segment=offset>=cell.length&&i<(report.repeatColumns??3)?cell.slice(0,count):cell.slice(offset,offset+count);if(segment.length)pdf.text(segment,x+2,y+4.5,{lineHeightFactor:line/(font*.352778)});x+=widths[i]});
    y+=height;offset+=count;if(offset<lines)nextPage();
   }
  });
 }
 const pages=pdf.getNumberOfPages();for(let n=1;n<=pages;n++){pdf.setPage(n);pdf.setTextColor('#71717a');pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.text(`${report.language==='en'?'Page':'Página'} ${n} / ${pages}`,285,204,{align:'right'})}
 return pdf;
}
