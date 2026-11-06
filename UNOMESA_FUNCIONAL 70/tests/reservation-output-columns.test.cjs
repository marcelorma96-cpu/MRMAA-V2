require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const columns=require('../lib/reservation-output-columns.ts');
const {reservationReportHtml}=require('../lib/reservation-report.ts');
const {createReservationPdf}=require('../lib/reservation-pdf.ts');
const {translate,translateRecord}=require('../lib/translations.ts');
const {formatEventTime}=require('../lib/local-date.ts');
const {reservationMenuLabel}=require('../lib/reservation-menu-label.ts');
const {reservationGuestTotal}=require('../lib/reservation-totals.ts');
const XLSX=require('xlsx');

// Execute the actual component's output functions with deterministic UI state and a captured download.
// This checks the integration's column order, localized headers, and XLSX cell types as well as the shared filter.
const source=ts.createSourceFile('reservations-enhanced.tsx',fs.readFileSync('components/reservations-enhanced.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=[];
function visit(node){if(ts.isFunctionDeclaration(node)&&['buildReport','exportRows','paymentMethodLabel'].includes(node.name?.text))functions.push(node.getText(source));ts.forEachChild(node,visit)}
visit(source);assert.equal(functions.length,3);
const code=ts.transpileModule(functions.join('\n')+'\nglobalThis.outputs={buildReport,exportRows};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function outputContext(selection={},options={}){
  let workbook,accessChecks=0;
  const language=options.en?'en':'es',context={...columns,translate,translateRecord,formatEventTime,reservationMenuLabel,reservationGuestTotal,
    outputColumns:selection,language,en:!!options.en,say:(es,en)=>options.en?en:es,
    restaurantName:'Fixture restaurant',restaurantId:'fixture',printMode:options.mode||'reservations',
    settings:{reservation_show_people:true,reservation_show_deposits:true,reservation_show_deposits_list:options.deposits!==false,time_format:'24h'},
    money:n=>`Q ${n.toFixed(2)}`,displayDate:value=>value.split('-').reverse().join('/'),appLocale:()=>language==='en'?'en-US':'es-GT',
    reportContext:()=> 'Selected dates',currentAppLanguage:()=>language,today:()=> '2026-11-06',
    excelAccess:{ensureAllowed:async()=>{accessChecks++}},recordAuditActivity:()=>Promise.resolve(),
    mode:'all',date:'2026-11-06',from:'2026-11-01',to:'2026-11-30',excludeCancelled:false,printTime:{mode:'all',from:'',to:''},
    require:name=>{assert.equal(name,'xlsx');return {...XLSX,writeFile:wb=>{workbook=wb}}},
  };
  vm.runInNewContext(code,context);
  return {...context.outputs,workbook:()=>workbook,accessChecks:()=>accessChecks};
}
const fixture={id:'r1',client_name:'Customer fixture',phone:'+502 5999 8888',event_date:'2026-11-06',event_time:'13:15',area:'Old area',guests:12,menu:'EVENTOS',deposit:125,payment_method:'efectivo',balance:375,status:'pendiente',notes:'Notes fixture'};
const labels={r1:'Salón + Terraza - Áreas completas'};

test('list print/PDF defaults remain intact; omitting any field removes its header and matching cells in both languages',()=>{
  for(const en of [false,true])for(const deposits of [false,true]){
    const all=outputContext({}, {en,deposits}).buildReport([fixture],labels),keys=columns.reservationListColumns(deposits);
    assert.equal(all.columns.length,keys.length);assert.equal(all.rows[0][3],fixture.phone);assert.equal(all.rows[0][4],labels.r1);
    for(const key of keys){
      const report=outputContext({[key]:false},{en,deposits}).buildReport([fixture],labels),index=keys.indexOf(key);
      assert.deepEqual(Array.from(report.columns,c=>c.label),Array.from(all.columns,c=>c.label).filter((_,i)=>i!==index));
      assert.deepEqual(Array.from(report.rows[0]),Array.from(all.rows[0]).filter((_,i)=>i!==index));
      assert.equal(report.repeatColumns,4-(index<4?1:0));
    }
  }
});
test('phone and notes are absent from print HTML and the actual PDF on every page, not merely hidden',()=>{
  const rows=Array.from({length:80},(_,i)=>({...fixture,id:`r${i}`,client_name:`Guest ${i}`}));
  const original=JSON.stringify(rows),report=outputContext({phone:false,notes:false},{en:true}).buildReport(rows);
  const html=reservationReportHtml(report);
  assert.doesNotMatch(html,/Phone|Notes fixture|5999 8888/);assert.match(html,/Guest 79/);
  const pdf=createReservationPdf(report),content=pdf.internal.pages.flat().join('\n');
  assert(pdf.getNumberOfPages()>1);assert.doesNotMatch(content,/Phone|Notes fixture|5999 8888/);assert.match(content,/Guest 79/);
  assert.equal(JSON.stringify(rows),original);
});
test('Excel download omits the same fields, keeps numeric guests and multi-area labels, and still checks permission twice',async()=>{
  for(const en of [false,true]){
    const output=outputContext({phone:false,notes:false},{en});await output.exportRows([fixture],labels);
    assert.equal(output.accessChecks(),2);
    const wb=XLSX.read(XLSX.write(output.workbook(),{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
    const headers=rows[0],data=rows[1];assert.equal(headers.length,10);assert.equal(data.length,10);
    assert(!JSON.stringify(rows).includes(fixture.phone));assert(!JSON.stringify(rows).includes(fixture.notes));
    assert.equal(data[3],labels.r1);assert.equal(data[4],12);assert.equal(typeof data[4],'number');
    assert.equal(data[9],translate(fixture.status,en?'en':'es'));
    assert(!headers.some(h=>/phone|tel[eé]fono|observaciones|notes/i.test(h)));
  }
});
test('single column reports use the full width and preserve long content; empty selection is blocked except summary',()=>{
  const keys=columns.reservationListColumns(true),none=Object.fromEntries(keys.map(key=>[key,false]));
  assert(columns.reservationColumnsError(keys,none,false));
  assert.throws(()=>outputContext(none).buildReport([fixture]),/RESERVATION_COLUMNS_EMPTY/);
  const summary=outputContext(none,{mode:'summary'}).buildReport([fixture]);
  assert.equal(summary.rows.length,0);assert.equal(summary.columns.length,0);assert.equal(summary.metrics[0].value,'1');
  const report=outputContext({...none,notes:true}).buildReport([{...fixture,notes:'Long notes '.repeat(700)+'ENDMARKER'}]);
  assert.equal(report.columns.length,1);assert.equal(report.repeatColumns,0);
  assert.match(reservationReportHtml(report),/width:100%/);
  const pdf=createReservationPdf(report);assert(pdf.getNumberOfPages()>1);assert.match(pdf.internal.pages.flat().join('\n'),/ENDMARKER/);
});
test('remembered choices tolerate invalid storage and isolate restaurants; absent or new fields default to included',()=>{
  for(const raw of [null,'bad','[]','true','null','4'])assert.deepEqual(columns.parseReservationColumnSelection(raw),{});
  assert.deepEqual(columns.parseReservationColumnSelection('{"phone":false,"client":true,"notes":"false","unknown":false}'),{client:true,phone:false});
  assert.notEqual(columns.reservationColumnsStorageKey('restaurant-a'),columns.reservationColumnsStorageKey('restaurant-b'));
  const restored=columns.parseReservationColumnSelection(JSON.stringify({phone:false}));
  assert.equal(columns.reservationColumnIndexes(columns.reservationExcelColumns,restored).length,11);
  assert.throws(()=>columns.selectReservationTableColumns(['phone'],[['phone','extra']],{}),/Invalid reservation report columns/);
});
test('floor reservation tables honor the same selection in normal/full reports and map-only remains available',()=>{
  const {demoFloor}=require('../lib/floor-plan.ts'),floor=require('../lib/floor-print.ts'),date='2026-11-06',data=demoFloor(date);
  data.reservations=data.reservations.map(r=>({...r,phone:fixture.phone}));
  const bookings=floor.floorPrintBookings(data,date,[],null),details=data.reservations.map(r=>({...r,menu:'EVENTOS',deposit:125,payment_method:'efectivo',notes:fixture.notes}));
  for(const mode of ['reservations','details','both'])for(const showDeposits of [false,true]){
    const input={restaurant:'Fixture',date,mode,map:{svg:'<svg/>',title:'Floor',areaIds:[]},data,bookings,details,en:true,showDeposits,money:String,scope:'All areas',includeCancelled:false,demo:true,columnSelection:{phone:false,notes:false}};
    const report=floor.floorPrintReport(input),html=floor.floorPrintHtml(input);
    assert.equal(report.columns.length,columns.reservationFloorColumns(mode==='details',showDeposits).filter(key=>!['phone','notes'].includes(key)).length);
    assert.doesNotMatch(html,/Phone|5999 8888|Notes fixture/);assert(report.rows.every(row=>row.length===report.columns.length));
    assert.equal(report.repeatColumns,4);
    const map=floor.floorPrintReport({...input,mode:'map',columnSelection:Object.fromEntries(columns.reservationFloorColumns(true,true).map(key=>[key,false]))});
    assert.equal(map.rows.length,0);
  }
});
