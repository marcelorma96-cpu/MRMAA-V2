const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require('typescript');
const XLSX = require('xlsx');
const cache = {};
function load(file) {
  file = path.resolve(root, file);
  if (cache[file]) return cache[file].exports;
  const module = {exports:{}}; cache[file] = module;
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,Date,Intl,TextEncoder,AbortController,require:name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(root+'/node_modules/'+name)});
  return module.exports;
}
const presentation = load('lib/report-presentation.ts');
const report = load('lib/report-data.ts');
const analysis = load('lib/report-consolidation.ts');
function scenario({kind,source,search='',grouping,page=1,denied=false}) {
  const events = {prints:[],books:[],states:[],permission:0,excelPermission:0};
  const from='2026-01-01',to='2026-11-27',restaurantId='isolated-fixture';
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const filters={kind,from,to,search,grouping,page};
  const values=[filters,0,'',false,{key:JSON.stringify([restaurantId,kind,from,to,timezone,0,0]),source}];
  let state=0;
  const element=(type,props,key)=>({type,props:props||{},key});
  const modules={
    'react':{useState:()=>{const i=state++;return [values[i],value=>events.states.push({i,value})]},useMemo:fn=>fn(),useRef:value=>({current:value}),useEffect:()=>{},useCallback:fn=>fn},
    'react/jsx-runtime':{jsx:element,jsxs:element,Fragment:'Fragment'},
    './pull-refresh':{useRefreshRegistration:()=>()=>()=>{}},
    './presentation-loading':{useModulePending:()=>{}},
    './app-context':{AppOptions:'AppOptions',AppRecord:'AppRecord',useAppMode:()=>false},
    'lucide-react':{FileSpreadsheet:'FileSpreadsheet',Printer:'Printer',RefreshCw:'RefreshCw'},
    '@/components/restaurant-sync':{useDataRefresh:()=>0},
    '@/components/excel-permission':{useExcelExportAccess:()=>({allowed:true,ensureAllowed:async()=>{events.excelPermission++}})},
    '@/components/app-preferences':{useAppPreferences:()=>({language:'es',currency:'GTQ',t:value=>value,money:value=>'GTQ '+new Intl.NumberFormat('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)})},
    '@/components/pagination':{Pagination:'Pagination',PAGE_SIZE:50},
    '@/lib/supabase':{supabase:{}},
    '@/lib/print':{printHtml:html=>events.prints.push(html)},
    '@/lib/audit-activity':{recordAuditActivity:async()=>{}},
    '@/lib/local-date':load('lib/local-date.ts'),
    '@/lib/export-limits':load('lib/export-limits.ts'),
    '@/lib/user-message':{userMessage:error=>String(error.message||error)},
    '@/lib/report-data':{...report,requireReportAccess:async()=>{events.permission++;if(denied)throw Error('Access denied')}},
    '@/lib/report-presentation':presentation,
    '@/lib/report-consolidation':analysis,
    'xlsx':{...XLSX,writeFile:(book,name)=>events.books.push({book,name})},
  };
  const code=ts.transpileModule(fs.readFileSync(root+'/components/reports-enhanced.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,Date,Intl,TextEncoder,AbortController,require:name=>{assert(name in modules,'Unexpected dependency '+name);return modules[name]}});
  const tree=module.exports.EnhancedReports({restaurantId,restaurantName:'Prueba <script>alert(1)</script>',timeFormat:'24h'});
  function walk(node,predicate,result=[]) {if(!node||typeof node!=='object')return result;if(Array.isArray(node)){node.forEach(value=>walk(value,predicate,result));return result}if(predicate(node))result.push(node);walk(node.props?.children,predicate,result);return result}
  const text=node=>node==null?'':Array.isArray(node)?node.map(text).join(' '):typeof node==='object'?text(node.props?.children):String(node);
  const buttons=walk(tree,node=>node.type==='button');
  return {events,tree,rows:walk(tree,node=>node.type==='tbody').flatMap(node=>node.props.children),async click(label){const button=buttons.find(node=>text(node).trim()===label);assert(button,'Missing button '+label);assert(!button.props.disabled,'Disabled button '+label);button.props.onClick();await new Promise(resolve=>setImmediate(resolve));return events}};
}

test('report exports preserve complete summaries, filtered breakdowns, units, limits and permissions', async()=>{
  const source=Array.from({length:121},(_,i)=>({Numero:'#'+i,Fecha:'01/11/2026',Cliente:i<110?'Ana':'Luis',Telefono:'123',Area:'Patio',Estado:'pendiente',Total:100,Anticipo:25,Saldo:75}));
  const quotes=scenario({kind:'allquotes',source,search:'Ana',page:2});
  assert.equal(quotes.rows.length,50,'The visible page has 50 rows');
  await quotes.click('Excel');
  const book=quotes.events.books[0].book;
  assert.equal(XLSX.utils.sheet_to_json(book.Sheets.Desglose).length,110,'Excel exports every filtered row, not the page');
  assert.equal(book.Sheets.Resumen.B2.v,121,'Summary keeps all source rows before search');
  assert.equal(book.Sheets.Resumen.B3.v,12100,'Summary retains full-period numeric sum');
  assert.equal(book.Sheets.Desglose.G2.t,'n','Amounts remain numeric');
  assert.equal(quotes.events.permission,1);assert.equal(quotes.events.excelPermission,2);
  await quotes.click('Imprimir');
  assert.equal((quotes.events.prints[0].match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)||[]).length,110,'Print exports every filtered row');
  assert(!quotes.events.prints[0].includes('<script>'));assert(quotes.events.prints[0].includes('&lt;script&gt;'));

  const many=scenario({kind:'conversion',source:Array.from({length:5001},()=>({Fecha:'01/11/2026',Area:'Patio',Cotizaciones:2,Convertidas:1,ConversionPct:50}))});
  await many.click('Imprimir');assert.equal(many.events.prints.length,1,'Print limit is applied after consolidation');
  await many.click('Excel');
  const conversion=many.events.books[0].book;
  assert.equal(XLSX.utils.sheet_to_json(conversion.Sheets.Desglose).length,1);
  assert.equal(conversion.Sheets.Resumen.B2.v,10002);assert.equal(conversion.Sheets.Resumen.B4.v,50);
  assert.equal(conversion.Sheets.Desglose.D2.v,50);assert.equal(conversion.Sheets.Desglose.D2.z,'0.00"%"');

  const formattedSearch=scenario({kind:'conversion',source:[{Fecha:'01/11/2026',Area:'Patio',Cotizaciones:2,Convertidas:1,ConversionPct:50}],search:'50%'});
  assert.equal(formattedSearch.rows.length,1,'Search matches the displayed percentage');
  const detailLimit=scenario({kind:'conversion',source:Array.from({length:2001},()=>({Fecha:'01/11/2026',Area:'Patio',Cotizaciones:2,Convertidas:1,ConversionPct:50})),grouping:'detail'});
  await detailLimit.click('Imprimir');assert.equal(detailLimit.events.prints.length,0,'Detail print refuses to truncate above its limit');
  assert(detailLimit.events.states.some(item=>typeof item.value==='string'&&item.value.includes('2,000')));

  const comparison=scenario({kind:'comparison',source:[{Indicador:'Conversión (%)',Actual:25,Anterior:20,Diferencia:5},{Indicador:'Valor cotizado',Actual:200,Anterior:100,Diferencia:100},{Indicador:'Reservaciones',Actual:15,Anterior:10,Diferencia:5}]});
  await comparison.click('Excel');const comparisonSheet=comparison.events.books[0].book.Sheets.Desglose;
  assert.equal(comparisonSheet.B2.z,'0.00"%"');assert.equal(comparisonSheet.D2.z,'0.00" pp"');assert(comparisonSheet.B3.z.includes('GTQ'));assert.equal(comparisonSheet.B4.z,'0.##');

  const deposits=scenario({kind:'deposits',source:[{Fecha:'01/11/2026',Cliente:'Ana',Origen:'Reserva',Metodo:'Efectivo',Anticipo:10},{Fecha:'01/11/2026',Cliente:'Luis',Origen:'Reserva',Metodo:'Efectivo',Anticipo:20},{Fecha:'01/11/2026',Cliente:'Marta',Origen:'Reserva',Metodo:'Tarjeta',Anticipo:30}],search:'Efectivo'});
  await deposits.click('Excel');const depositBook=deposits.events.books[0].book;
  assert.equal(XLSX.utils.sheet_to_json(depositBook.Sheets.Desglose).length,1);assert.equal(depositBook.Sheets.Resumen.B2.v,60);assert.equal(depositBook.Sheets.Desglose.C2.v,30);

  const denied=scenario({kind:'allquotes',source,denied:true});await denied.click('Imprimir');assert.equal(denied.events.prints.length,0);assert(denied.events.states.some(item=>item.value==='Access denied'));
});
