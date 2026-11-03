require('tsx/cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {customerPhoneNumber,customerPhoneCountry}=require('../lib/customer-phone.ts');
const {readQuoteSummaryPage}=require('../lib/quote-data.ts');
const {createClient}=require('@supabase/supabase-js');
const {copyText}=require('../lib/clipboard.ts');

test('phone controls work without a configured messaging account and omit empty-number actions',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const previous=require.extensions['.css'];
 try{
  require.extensions['.css']=m=>{m.exports={phone:'phone',number:'number',copyButton:'copyButton'}};
  const {CustomerPhone}=require('../components/customer-phone.tsx');
  const {CustomerContactCountryProvider}=require('../components/customer-contact-country.tsx');
  const render=props=>renderToStaticMarkup(React.createElement(CustomerContactCountryProvider,{country:'Guatemala'},React.createElement(CustomerPhone,{name:'Ana',...props})));
  const local=render({phone:'5555-4444'});
  assert.match(local,/\+502 5555 4444/);assert.match(local,/aria-label="Copiar número de Ana"/);
  assert.match(local,/type="button"/);assert.doesNotMatch(local,/WhatsApp|<a\b|aria-haspopup/);
  const english=render({phone:'+18035551234',en:true});assert.match(english,/Copy number for Ana/);
  for(const phone of ['',null,undefined,'   '])assert.doesNotMatch(render({phone}),/<button\b/);
  const extension=render({phone:'5555-4444 ext. 2'});assert.match(extension,/5555-4444 ext. 2/);assert.match(extension,/Copiar número de Ana/);
 }finally{if(previous)require.extensions['.css']=previous;else delete require.extensions['.css'];}
});

test('clipboard writes exactly the phone and falls back honestly when permission is denied',async()=>{
 const savedNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),savedDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 const set=(key,value)=>Object.defineProperty(globalThis,key,{configurable:true,value});
 const copied=[],legacy=[];let removed=0,restored=0,selected='',commandResult=true;
 try{
  set('navigator',{clipboard:{writeText:async value=>copied.push(value)}});
  set('document',undefined);
  assert.equal(await copyText('+50255554444'),true);assert.deepEqual(copied,['+50255554444']);
  assert.equal(await copyText(''),false);assert.equal(copied.length,1);
  const document={activeElement:{focus:()=>restored++},getSelection:()=>null,body:{appendChild:()=>{}},createElement:()=>({style:{},value:'',focus(){},select(){selected=this.value},setSelectionRange(){},remove(){removed++}}),execCommand:command=>{assert.equal(command,'copy');legacy.push(selected);return commandResult;}};
  set('document',document);
  set('navigator',{clipboard:{writeText:async()=>{throw new Error('NotAllowedError')}}});
  assert.equal(await copyText('+525512345678'),true);assert.deepEqual(legacy,['+525512345678']);
  assert.equal(removed,1);assert.equal(restored,1);
  commandResult=false;assert.equal(await copyText('5555-4444 ext. 2'),false);
  assert.equal(removed,2);assert.equal(restored,2);
  set('navigator',{});commandResult=true;
  assert.equal(await copyText('+18035551234'),true);assert.equal(legacy.at(-1),'+18035551234');
  document.execCommand=()=>{throw new Error('unsupported')};
  assert.equal(await copyText('+50255554444'),false);assert.equal(removed,4);assert.equal(restored,4);
 }finally{
  if(savedNavigator)Object.defineProperty(globalThis,'navigator',savedNavigator);else delete globalThis.navigator;
  if(savedDocument)Object.defineProperty(globalThis,'document',savedDocument);else delete globalThis.document;
 }
});

test('local numbers use a recognized country without duplicating existing codes or inventing missing regional digits',()=>{
 const cases=[['5555-4444','Guatemala','50255554444'],['55 1234 5678','México','525512345678'],['(803) 555-1234','US','18035551234'],['50255554444','GT','50255554444'],['525512345678','GT','525512345678'],['+1 803 555 1234','GT','18035551234'],['0052 55 1234 5678','US','525512345678'],['https://wa.me/50255554444','MX','50255554444'],['11 98765 4321','Brasil','5511987654321'],['020 7946 0958','UK','442079460958'],['06 12 34 56 78','France','33612345678']];
 for(const [phone,country,expected] of cases){assert.equal(customerPhoneNumber(phone,country),expected,`${phone} ${country}`);}
 for(const [phone,country] of [['5551234','US'],['55554444','unknown'],['+502 555','GT'],['+999123456789','GT'],['55554444 ext. 2','GT'],['55554444 / 55553333','GT'],['javascript:55554444','GT']])assert.equal(customerPhoneNumber(phone,country),'',phone);
 assert.equal(customerPhoneCountry('Guatemala','US'),'GT');
 assert.equal(customerPhoneCountry('México','GT'),'MX');
 assert.equal(customerPhoneCountry('EE. UU.'),'US');
 assert.equal(customerPhoneCountry('','MX'),'MX');
 assert.equal(customerPhoneCountry('unrecognized','GT'),'GT');
 assert.equal(customerPhoneCountry('',null),undefined);
});

test('quote summaries load the customer phone in the existing bounded, tenant-scoped read',async()=>{
 const calls=[],restaurant='33333333-3333-4333-8333-333333333333';
 const client=createClient('https://fixture.supabase.co','fake-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);calls.push(url);
  assert.equal(init?.method||'GET','GET');
  assert.equal(url.pathname,'/rest/v1/v2_quotes');
  assert.equal(url.searchParams.get('restaurant_id'),'eq.'+restaurant);
  assert.equal(url.searchParams.get('deleted_at'),'is.null');
  assert.equal(url.searchParams.get('limit'),'26');
  assert(url.searchParams.get('select').split(',').includes('client_phone'));
  return new Response(JSON.stringify([{id:'11111111-1111-4111-8111-111111111111',restaurant_id:restaurant,quote_number:42,client_name:'Ana',client_phone:'+50255554444',event_date:'2026-11-21',status:'pendiente'}]),{headers:{'Content-Type':'application/json'}});
 }}});
 const result=await readQuoteSummaryPage(client,restaurant,'','2026-11-03','quote_number',true,null,new AbortController().signal);
 assert.equal(result.rows[0].client_phone,'+50255554444');assert.equal(calls.length,1);
});


