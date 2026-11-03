require('tsx/cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {customerWhatsAppNumber,customerWhatsAppMessage,customerWhatsAppLink}=require('../lib/customer-whatsapp.ts');
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
   assert.match(html,/href="https:\/\/wa\.me\/50255554444\?text=/);
   assert.match(html,/target="_blank"/);assert.match(html,/rel="noopener noreferrer"/);
   assert.match(html,/aria-label="Abrir WhatsApp para Ana"/);assert.doesNotMatch(html,/<button/);
  }
  const incomplete=render({phone:'5555-4444'});
  assert.match(incomplete,/type="button"/);assert.match(incomplete,/aria-haspopup="dialog"/);assert.doesNotMatch(incomplete,/<a\b/);
  const empty=render({phone:null});assert.match(empty,/Sin teléfono/);assert.doesNotMatch(empty,/<(?:button|a)\b/);
  const english=render({phone:'+18035551234',en:true});assert.match(english,/Open WhatsApp for Ana/);assert.match(english,/Hello%20Ana/);
 }finally{if(previous)require.extensions['.css']=previous;else delete require.extensions['.css'];}
});

test('customer phones require an international destination; local and unsafe values do not open a chat',()=>{
 const valid=[['+502 5555-4444','50255554444'],['50255554444','50255554444'],['00502 5555 4444','50255554444'],['+1 (803) 555-1234','18035551234'],['18035551234','18035551234'],['+52 55 1234 5678','525512345678'],['+44 20 7946 0958','442079460958'],['https://wa.me/50255554444','50255554444'],['https://api.whatsapp.com/send?phone=%2B50255554444','50255554444']];
 for(const [raw,expected] of valid)assert.equal(customerWhatsAppNumber(raw),expected,raw);
 for(const raw of ['',undefined,null,'55554444','5555-4444','6012345678','+502 555','+502 5555 4444 ext. 2','+50255554444 / +18035551234','javascript:alert(1)','https://evil.test/50255554444','https://wa.me@evil.test/50255554444','+999 123456789']){
  assert.equal(customerWhatsAppNumber(raw),'',String(raw));assert.equal(customerWhatsAppLink(raw,'Hola'),'',String(raw));
 }
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
