require('tsx/cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {customerWhatsAppNumber,customerWhatsAppMessage,customerWhatsAppLink,customerWhatsAppCountry,customerWhatsAppWebLink}=require('../lib/customer-whatsapp.ts');
const {nativeContactTarget}=require('../lib/public-contact.ts');
const {readQuoteSummaryPage}=require('../lib/quote-data.ts');
const {createClient}=require('@supabase/supabase-js');

test('the shared phone control renders a safe link, a correction action or no action as appropriate',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const previous=require.extensions['.css'];
 try{
  require.extensions['.css']=m=>{m.exports={phone:'phone',number:'number',button:'button'}};
  const {CustomerPhone}=require('../components/customer-phone.tsx');
  const render=props=>renderToStaticMarkup(React.createElement(CustomerPhone,{name:'Ana',restaurantName:'Restaurante de prueba',...props}));
  for(const context of ['customer','reservation','quote','request']){
   const html=render({phone:'+502 5555-4444',context,eventDate:'2026-11-21'});
   assert.match(html,/href="https:\/\/web\.whatsapp\.com\/send\?phone=50255554444&amp;text=/);
   assert.match(html,/target="_blank"/);assert.match(html,/rel="noopener noreferrer"/);
   assert.match(html,/aria-label="Abrir WhatsApp Web para Ana"/);assert.doesNotMatch(html,/<button/);
  }
  const incomplete=render({phone:'5555-4444'});
  assert.match(incomplete,/type="button"/);assert.match(incomplete,/aria-haspopup="dialog"/);assert.doesNotMatch(incomplete,/<a\b/);
  const empty=render({phone:null});assert.match(empty,/Sin teléfono/);assert.doesNotMatch(empty,/<(?:button|a)\b/);
  const english=render({phone:'+18035551234',en:true});assert.match(english,/Open WhatsApp Web for Ana/);assert.match(english,/Hello%20Ana/);
 }finally{if(previous)require.extensions['.css']=previous;else delete require.extensions['.css'];}
});

test('customer phones require an international destination; local and unsafe values do not open a chat',()=>{
 const valid=[['+502 5555-4444','50255554444'],['50255554444','50255554444'],['00502 5555 4444','50255554444'],['+1 (803) 555-1234','18035551234'],['18035551234','18035551234'],['+52 55 1234 5678','525512345678'],['+44 20 7946 0958','442079460958'],['https://wa.me/50255554444','50255554444'],['https://api.whatsapp.com/send?phone=%2B50255554444','50255554444']];
 for(const [raw,expected] of valid)assert.equal(customerWhatsAppNumber(raw),expected,raw);
 for(const raw of ['',undefined,null,'55554444','5555-4444','6012345678','+502 555','+502 5555 4444 ext. 2','+50255554444 / +18035551234','javascript:alert(1)','https://evil.test/50255554444','https://wa.me@evil.test/50255554444','+999 123456789']){
  assert.equal(customerWhatsAppNumber(raw),'',String(raw));assert.equal(customerWhatsAppLink(raw,'Hola'),'',String(raw));
 }
});

test('local numbers use a recognized country without duplicating existing codes or inventing missing regional digits',()=>{
 const cases=[['5555-4444','Guatemala','50255554444'],['55 1234 5678','México','525512345678'],['(803) 555-1234','US','18035551234'],['50255554444','GT','50255554444'],['525512345678','GT','525512345678'],['+1 803 555 1234','GT','18035551234'],['0052 55 1234 5678','US','525512345678'],['https://wa.me/50255554444','MX','50255554444'],['11 98765 4321','Brasil','5511987654321'],['020 7946 0958','UK','442079460958'],['06 12 34 56 78','France','33612345678']];
 for(const [phone,country,expected] of cases){assert.equal(customerWhatsAppNumber(phone,country),expected,`${phone} ${country}`);assert.equal(new URL(customerWhatsAppLink(phone,'Hola',country)).pathname,'/'+expected);}
 for(const [phone,country] of [['5551234','US'],['55554444','unknown'],['+502 555','GT'],['+999123456789','GT'],['55554444 ext. 2','GT'],['55554444 / 55553333','GT'],['javascript:55554444','GT']])assert.equal(customerWhatsAppNumber(phone,country),'',phone);
 assert.equal(customerWhatsAppCountry('Guatemala','US'),'GT');
 assert.equal(customerWhatsAppCountry('México','GT'),'MX');
 assert.equal(customerWhatsAppCountry('EE. UU.'),'US');
 assert.equal(customerWhatsAppCountry('','MX'),'MX');
 assert.equal(customerWhatsAppCountry('unrecognized','GT'),'GT');
 assert.equal(customerWhatsAppCountry('',null),undefined);
});

test('dashboard contact country follows the restaurant, uses detection only as fallback, and offers setup before contact',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const previous=require.extensions['.css'];
 try{
  require.extensions['.css']=m=>{m.exports={phone:'phone',number:'number',button:'button',iconButton:'iconButton'}};
  const {CustomerPhone}=require('../components/customer-phone.tsx');
  const {CustomerContactCountryProvider}=require('../components/customer-contact-country.tsx');
  const {AppPreferencesContext}=require('../components/app-preferences.tsx');
  const render=(country,phone,businessWhatsApp='+50255553333',detected='US')=>renderToStaticMarkup(React.createElement(AppPreferencesContext.Provider,{value:{country:detected}},React.createElement(CustomerContactCountryProvider,{country,businessWhatsApp,onConfigure:()=>{}},React.createElement(CustomerPhone,{name:'Ana',phone,context:'reservation',eventDate:'2026-11-21'}))));
  const gt=render('Guatemala','5555-4444');assert.match(gt,/href="https:\/\/web\.whatsapp\.com\/send\?phone=50255554444&amp;text=/);assert.match(gt,/\+502 5555 4444/);assert.doesNotMatch(gt,/>WhatsApp<\/span>/);assert.match(gt,/<svg[^>]+aria-hidden="true"/);
  assert.match(render('México','55 1234 5678'),/web\.whatsapp\.com\/send\?phone=525512345678/);
  assert.match(render(null,'803 555 1234'),/web\.whatsapp\.com\/send\?phone=18035551234/);
  const unset=render('GT','55554444','');assert.match(unset,/aria-label="Configurar WhatsApp del restaurante"/);assert.doesNotMatch(unset,/<a\b/);
  assert.match(render('GT','+18035551234'),/web\.whatsapp\.com\/send\?phone=18035551234/);
 }finally{if(previous)require.extensions['.css']=previous;else delete require.extensions['.css'];}
});

test('WhatsApp settings accepts a local business number and opens the official login without claiming a linked session',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {WhatsAppSettings}=require('../components/whatsapp-settings.tsx');
 const render=phone=>renderToStaticMarkup(React.createElement(WhatsAppSettings,{phone,country:'Guatemala',en:false,onChange:()=>{}}));
 const valid=render('55554444');assert.match(valid,/Número completo: \+50255554444/);assert.match(valid,/href="https:\/\/web\.whatsapp\.com\/"/);assert.match(valid,/guardar el número no inicia sesión/);assert.doesNotMatch(valid,/role="alert"/);
 assert.match(render('123'),/role="alert"/);
});

test('messages use the right customer, business and context, with no automatic confirmation or private event notes',()=>{
 const input={name:'Ana & José',restaurantName:'Restaurante de prueba',eventDate:'2026-11-21'},before=JSON.stringify(input);
 for(const [context,topic] of [['reservation','su reservación'],['quote','su cotización'],['request','su solicitud de evento']]){
  assert.equal(customerWhatsAppMessage({...input,context}),`Hola Ana & José, le escribimos de Restaurante de prueba sobre ${topic} para el 21 de noviembre de 2026.`);
 }
 assert.equal(customerWhatsAppMessage(input),'Hola Ana & José, le escribimos de Restaurante de prueba.');
 assert.equal(customerWhatsAppMessage({...input,context:'reservation',en:true}),"Hello Ana & José, we're contacting you from Restaurante de prueba about your reservation for November 21, 2026.");
 assert.equal(customerWhatsAppMessage({}),'Hola, le escribimos de nuestro restaurante.');
 assert.equal(customerWhatsAppMessage({context:'reservation',eventDate:'2026-02-31'}),'Hola, le escribimos de nuestro restaurante sobre su reservación.');
 assert.equal(customerWhatsAppMessage({name:'Ana\nMaría',restaurantName:' Prueba\tSur '}),'Hola Ana María, le escribimos de Prueba Sur.');
 assert.equal(JSON.stringify(input),before);
});

test('the official link safely encodes a draft and keeps browser/native navigation behavior',()=>{
 const message='Hola Ana & José, cotización #42? Gracias 😊';
 const href=customerWhatsAppLink('+502 5555-4444',message),url=new URL(href);
 assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/50255554444');assert.equal(url.searchParams.get('text'),message);assert.equal([...url.searchParams].length,1);
 assert.equal(nativeContactTarget(false,href),'_blank');assert.equal(nativeContactTarget(true,href),undefined);
});

test('event dates stay on the same day in every device timezone',()=>{
 const previous=process.env.TZ;
 try{for(const tz of ['America/Guatemala','Pacific/Honolulu','Pacific/Auckland']){
  process.env.TZ=tz;
  assert.match(customerWhatsAppMessage({context:'reservation',eventDate:'2026-11-21'}),/21 de noviembre de 2026/);
 }}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
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


test('Web is the primary destination and the app alternative keeps the same recipient and exact draft',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const previous=require.extensions['.css'];
 try{
  require.extensions['.css']=m=>{m.exports={actions:'actions',button:'button',openOptions:'options',appAlternative:'alternative'}};
  const {WhatsAppOpenOptions}=require('../components/whatsapp-open-options.tsx');
  const message='Hola Ana & José. Cotización #12: Q 1,000.00 / menú + café?';
  for(const en of [true,false]){
   const html=renderToStaticMarkup(React.createElement(WhatsAppOpenOptions,{phone:'5555-4444',country:'GT',message,en}));
   const links=[...html.matchAll(/href="([^"]+)"/g)].map(x=>new URL(x[1].replaceAll('&amp;','&')));
   assert.equal(links.length,2);assert.equal(links[0].hostname,'web.whatsapp.com');assert.equal(links[0].searchParams.get('phone'),'50255554444');assert.equal(links[1].hostname,'wa.me');assert.equal(links[1].pathname,'/50255554444');
   assert(links.every(x=>x.searchParams.get('text')===message));
   assert.match(html,en?/Open app/:/Abrir aplicación/);
  }
  const bad=renderToStaticMarkup(React.createElement(WhatsAppOpenOptions,{phone:'123',country:'GT',message}));assert.doesNotMatch(bad,/<a /);assert.match(bad,/disabled/);
  assert.equal(customerWhatsAppWebLink('javascript:alert(1)',message,'GT'),'');
 }finally{if(previous)require.extensions['.css']=previous;else delete require.extensions['.css'];}
});
