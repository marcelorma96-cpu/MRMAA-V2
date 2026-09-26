import { jsPDF } from 'jspdf';
export type SchedulePdfCell = { text: string; color: string };
export type SchedulePdfPage = { area: string; dates: {label:string}[]; rows: {name:string;cells:SchedulePdfCell[]}[] };
export type SchedulePrintOptions = { layout?: 'continuous' | 'area'; scale?: number };
// Pagination happens after applying scale, identically for PDF and print.
export function createSchedulePdf(pages:SchedulePdfPage[],from:string,to:string,language:string,observations='',options:SchedulePrintOptions={}) {
 if(!pages.length)throw new Error('No hay horarios en las áreas y fechas seleccionadas.');
 const en=language==='en', scale=options.scale??100;
 if(!Number.isFinite(scale)||scale<70||scale>120)throw new Error(en?'Choose a print scale from 70% to 120%.':'Elija una escala de impresión entre 70% y 120%.');
 const s=scale/100, separate=options.layout==='area';
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 doc.setProperties({title:en?'Employee schedules':'Horarios de empleados'});
 doc.viewerPreferences({PrintScaling:'AppDefault',PickTrayByPDFSize:true});
 const margin=7,width=283,nameWidth=34,lineHeight=3.1*s,font=7*s,padding=3*s,minHeight=8*s;
 doc.setFont('helvetica','normal');doc.setFontSize(8);
 const note=observations.trim(),noteLines=note?doc.splitTextToSize(note,width-4) as string[]:[];
 if(note.length>1000||noteLines.length>12)throw new Error(en?'Shorten the print observations to 1,000 characters and 12 printed lines or fewer.':'Reduzca las observaciones a un máximo de 1,000 caracteres y 12 líneas impresas.');
 const footerTop=199-(9+noteLines.length*3.4),bottom=noteLines.length?footerTop-3:199;
 let y=0,first=true,pageNumber=0;
 const wrap=(text:string,w:number)=>doc.splitTextToSize(text||' ',w) as string[];
 const newPage=()=>{
  if(!first)doc.addPage('a4','landscape');first=false;pageNumber++;
  doc.setTextColor('#18181b');doc.setFont('helvetica','bold');doc.setFontSize(14*s);
  doc.text(en?'Employee schedule':'Horario de empleados',margin,7+6*s);
  doc.setFont('helvetica','normal');doc.setFontSize(8*s);doc.text(`${en?'Period':'Periodo'}: ${from} - ${to}`,margin,7+11*s);
  y=7+16*s;
  doc.setFontSize(7);doc.text(String(pageNumber),290,205,{align:'right'});
  if(noteLines.length){
   doc.setDrawColor('#a1a1aa');doc.setLineWidth(.2);doc.line(margin,footerTop,margin+width,footerTop);
   doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(en?'Observations':'Observaciones',margin,footerTop+4);
   doc.setFont('helvetica','normal');doc.text(noteLines,margin,footerTop+8,{lineHeightFactor:3.4/(8*.352778)});
  }
 };
 for(const page of pages){
  if(!page.rows.length)continue;
  if(!page.dates.length||page.dates.length>14)throw new Error('Rango de página inválido.');
  const cellWidth=(width-nameWidth)/page.dates.length;
  doc.setFont('helvetica','bold');doc.setFontSize(10*s);
  const areaLines=wrap(page.area,width),areaHeight=(areaLines.length*4+2)*s,tableHeight=10*s;
  if(areaHeight+tableHeight+minHeight>bottom-(7+16*s))throw new Error(en?'Shorten the area name.':'Acorte el nombre del área.');
  const prepare=(row:SchedulePdfPage['rows'][number])=>{
   if(row.cells.length!==page.dates.length)throw new Error('Columnas de horario inválidas.');
   doc.setFont('helvetica','bold');doc.setFontSize(font);const name=wrap(row.name,nameWidth-3*s);
   doc.setFont('helvetica','normal');const columns=row.cells.map(cell=>wrap(cell.text,cellWidth-3*s));
   const totalLines=Math.max(name.length,...columns.map(lines=>lines.length));
   return {name,columns,totalLines,height:Math.max(minHeight,totalLines*lineHeight+padding)};
  };
  const firstRow=prepare(page.rows[0]);
  const freshCapacity=bottom-(7+16*s)-areaHeight-tableHeight;
  // Keep the area heading with its first row (or the first fragment of a long row).
  if(first||separate||y+4*s+areaHeight+tableHeight+Math.min(firstRow.height,freshCapacity)>bottom)newPage();
  else y+=4*s;
  let tableTop=0;
  const areaHeader=()=>{
   doc.setTextColor('#18181b');doc.setFont('helvetica','bold');doc.setFontSize(10*s);
   doc.text(areaLines,margin,y+3*s,{lineHeightFactor:4/(10*.352778)});y+=areaHeight;
   doc.setFillColor('#18181b');doc.rect(margin,y,width,tableHeight,'F');doc.setTextColor('#ffffff');doc.setFontSize(font);
   doc.text(en?'Employee':'Empleado',margin+1.5*s,y+5.5*s);
   page.dates.forEach((date,i)=>doc.text(date.label.split('\n'),margin+nameWidth+i*cellWidth+cellWidth/2,y+3.5*s,{align:'center',lineHeightFactor:1.15}));
   y+=tableHeight;tableTop=y;
  };
  const continuePage=()=>{newPage();areaHeader();};
  areaHeader();
  for(const row of page.rows){
   const {name,columns,totalLines,height}=prepare(row);
   if(y+height>bottom&&y>tableTop)continuePage();
   let offset=0;
   while(offset<totalLines){
    const count=Math.floor((bottom-y-padding)/lineHeight);
    if(count<1||y+minHeight>bottom){continuePage();continue;}
    const take=Math.min(totalLines-offset,count),rowHeight=Math.max(minHeight,take*lineHeight+padding);
    const draw=(x:number,w:number,color:string,lines:string[],bold=false)=>{
     doc.setFillColor(/^#[0-9a-f]{6}$/i.test(color)?color:'#ffffff');doc.setDrawColor('#8b8b92');doc.setLineWidth(.15);doc.rect(x,y,w,rowHeight,'FD');
     doc.setTextColor('#18181b');doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(font);
     const segment=bold&&offset>=lines.length?lines.slice(0,take):lines.slice(offset,offset+take);
     if(segment.length)doc.text(segment,x+1.5*s,y+3*s,{lineHeightFactor:lineHeight/(font*.352778)});
    };
    draw(margin,nameWidth,'#ffffff',name,true);
    columns.forEach((lines,i)=>draw(margin+nameWidth+i*cellWidth,cellWidth,row.cells[i].color,lines));
    y+=rowHeight;offset+=take;
    if(offset<totalLines)continuePage();
   }
  }
 }
 if(first)throw new Error(en?'No schedules to print.':'No hay horarios para imprimir.');
 return doc;
}
