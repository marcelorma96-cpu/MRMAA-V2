import {localDateISO} from './local-date';

export type EventSearchResource='reservations'|'quotes';
export const eventSearchFields=[
 ['all','Todo','All fields'],['client_name','Cliente','Customer'],['phone','Teléfono','Phone'],
 ['deposit','Anticipo','Deposit'],['payment_method','Método de pago','Payment method'],
 ['total','Total','Total'],['balance','Saldo','Balance'],['guests','Invitados','Guests'],
 ['area','Área','Area'],['event_date','Fecha del evento','Event date'],['event_time','Hora','Time'],
 ['status','Estado','Status'],['notes','Observaciones','Notes'],['menu','Menú','Menu'],
 ['email','Correo','Email'],['quote_number','N.º de cotización','Quote number'],
] as const;
export type EventSearchField=typeof eventSearchFields[number][0];
export const normalizeEventSearch=(value:string)=>value.trim().slice(0,150);
export function eventSearchField(value:unknown,resource:EventSearchResource):EventSearchField{
 return eventSearchFields.some(([field])=>field===value)&&!(resource==='reservations'&&['email','quote_number'].includes(String(value)))&&!(resource==='quotes'&&value==='menu')?value as EventSearchField:'all';
}
export function eventSearchOptions(resource:EventSearchResource){return eventSearchFields.filter(([field])=>eventSearchField(field,resource)===field);}

/** Accept plain amounts, decimal comma and conventional thousands separators. */
export function searchAmount(value:string):number|null{
 let text=value.trim().replace(/^(?:US\$|GTQ|USD|MXN|Q|\$)\s*/i,'').replace(/\s*(?:GTQ|USD|MXN)$/i,'').trim();
 if(/^\d{1,3}(?:[ ,]\d{3})+(?:\.\d{1,2})?$/.test(text))text=text.replace(/[ ,]/g,'');
 else if(/^\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?$/.test(text))text=text.replace(/[ .]/g,'').replace(',','.');
 else if(/^\d+(?:[.,]\d{1,2})?$/.test(text))text=text.replace(',','.');
 else return null;
 const number=Number(text);
 return Number.isFinite(number)&&number>=0&&number<=999999999999.99?number:null;
}
function searchDate(value:string){
 const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})$/),local=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(!iso&&!local)return null;
 const [year,month,day]=iso?iso.slice(1).map(Number):[Number(local![3]),Number(local![2]),Number(local![1])];
 if(year<1000||year>9999||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate())return null;
 return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function searchTime(value:string){
 const match=value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
 if(!match)return null;
 let hour=Number(match[1]);const minute=Number(match[2]),second=Number(match[3]||0),period=match[4]?.toLowerCase();
 if(minute>59||second>59||(period?(hour<1||hour>12):hour>23))return null;
 if(period)hour=hour%12+(period==='pm'?12:0);
 return `${String(hour).padStart(2,'0')}:${match[2]}:${String(second).padStart(2,'0')}`;
}
export function eventSearchSpec(value:string,field:unknown='all',resource:EventSearchResource='reservations'){
 const text=normalizeEventSearch(value),lower=text.toLowerCase();
 return {text,field:eventSearchField(field,resource),amount:searchAmount(text),date:searchDate(text),time:searchTime(text),
  deposit_mode:['con anticipo','with deposit'].includes(lower)?'with':['sin anticipo','without deposit','no deposit'].includes(lower)?'without':null};
}
type Clause={column:string;op:'text'|'eq'|'neq'|'gt'|'lt'|'gte'|'lte'|'is';value:string|number|null};
const textColumns=(resource:EventSearchResource)=>resource==='reservations'
 ? {client_name:['client_name'],phone:['phone'],area:['area'],menu:['menu'],notes:['notes'],payment_method:['payment_method']}
 : {client_name:['client_name'],phone:['client_phone'],area:['area'],email:['client_email'],notes:['customer_note','internal_notes'],payment_method:['payment_method']};

function searchGroups(resource:EventSearchResource,value:string,field:unknown,today:string):Clause[][]{
 const s=eventSearchSpec(value,field,resource),groups:Clause[][]=[];
 const add=(column:string,op:Clause['op'],value:Clause['value'])=>groups.push([{column,op,value}]);
 const include=(key:string)=>s.field==='all'||s.field===key;
 for(const [key,columns] of Object.entries(textColumns(resource)))if(include(key))for(const column of columns)add(column,'text',s.text);
 if(include('status')){
  if(resource==='reservations')add('status','text',s.text);
  else{
   groups.push([{column:'status',op:'neq',value:'pendiente'},{column:'status',op:'text',value:s.text}]);
   const [year,month,day]=today.split('-').map(Number),end=localDateISO(new Date(year,month-1,day+5)),term=s.text.toLowerCase();
   const pending:Clause={column:'status',op:'eq',value:'pendiente'};
   if(['contactar','contact'].some(label=>label.includes(term)))groups.push([pending,{column:'event_date',op:'gte',value:today},{column:'event_date',op:'lte',value:end}]);
   if(['no realizada','not held'].some(label=>label.includes(term)))groups.push([pending,{column:'event_date',op:'lt',value:today}]);
   if(['pendiente','pending'].some(label=>label.includes(term))){groups.push([pending,{column:'event_date',op:'gt',value:end}]);groups.push([pending,{column:'event_date',op:'is',value:null}]);}
  }
 }
 for(const column of ['deposit','total','balance'])if(include(column)&&s.amount!==null){add(column,'eq',s.amount);if(s.amount===0)add(column,'is',null);}
 if(include('deposit')&&s.deposit_mode){if(s.deposit_mode==='with')add('deposit','gt',0);else{add('deposit','eq',0);add('deposit','is',null);}}
 if(include('guests')&&s.amount!==null&&Number.isInteger(s.amount)&&s.amount<=2147483647)add('guests','eq',s.amount);
 if(resource==='quotes'&&include('quote_number')&&/^#?\d+$/.test(s.text)){
  const number=Number(s.text.replace('#',''));if(number<=2147483647)add('quote_number','eq',number);
 }
 if(include('event_date')&&s.date)add('event_date','eq',s.date);
 if(include('event_time')&&s.time)add('event_time','eq',s.time);
 return groups;
}
/** Quoted PostgREST literals keep punctuation out of the filter grammar. */
export function eventSearchFilter(resource:EventSearchResource,value:string,field:unknown='all',today=localDateISO()){
 if(!normalizeEventSearch(value))return '';
 const clause=(c:Clause)=>`${c.column}.${c.op==='text'?'ilike':c.op}.${c.op==='text'?JSON.stringify(`%${String(c.value).replace(/[\\%_]/g,char=>'\\'+char)}%`):c.value===null?'null':JSON.stringify(c.value)}`;
 return searchGroups(resource,value,field,today).map(group=>group.length===1?clause(group[0]):`and(${group.map(clause).join(',')})`).join(',')||'id.is.null';
}
export function applyEventSearch(query:any,resource:EventSearchResource,value:string,field:unknown='all',today=localDateISO()){
 const filter=eventSearchFilter(resource,value,field,today);return filter?query.or(filter):query;
}
export function matchesEventSearch(row:Record<string,any>,resource:EventSearchResource,value:string,field:unknown='all',today=localDateISO()){
 if(!normalizeEventSearch(value))return true;
 return searchGroups(resource,value,field,today).some(group=>group.every(c=>{
  const actual=row[c.column];if(c.op==='is')return actual==null;if(actual==null)return false;
  if(c.op==='text')return String(actual).toLocaleLowerCase().includes(String(c.value).toLocaleLowerCase());
  const a=c.column==='event_time'?searchTime(String(actual)):typeof c.value==='number'?Number(actual):actual,b=c.value;
  switch(c.op){case 'eq':return a===b;case 'neq':return a!==b;case 'gt':return a>b!;case 'gte':return a>=b!;case 'lt':return a<b!;case 'lte':return a<=b!;}
 }));
}
