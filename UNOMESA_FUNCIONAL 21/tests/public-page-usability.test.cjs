require('tsx/cjs');
const test = require('node:test'), assert = require('node:assert/strict');
const {addPublicCatalogCards} = require('../lib/public-catalog.ts');
const {whatsappNumber, officialWhatsAppLink, nativeContactTarget} = require('../lib/public-contact.ts');
const {publicPdfUrl, contactLink, cleanContent, maximumGuests} = require('../lib/restaurant-public.ts');
const {GET} = require('../app/menus/[restaurant]/[file]/[name]/route.ts');
const restaurant = '22222222-2222-4222-8222-222222222222', file = '33333333-3333-4333-8333-333333333333';
const pdfPath = `${restaurant}/${file}.pdf`;

test('bulk selection keeps existing customized cards, manual entries and catalog intact', () => {
  const existing = [{id:'custom',source_id:'1',name:'My public name',price:'250',image:'kept'}, {id:'manual',name:'Manual'}];
  const sources = [{id:'1',name:'Internal name',price:300}, {id:'2',name:'New menu',price:100}, {id:'2',name:'Duplicate'}];
  const before = structuredClone({existing,sources});
  const selected = addPublicCatalogCards(existing,sources,'menus','Eventos');
  assert.equal(selected.length,3); assert.deepEqual(selected.slice(0,2),existing);
  assert.equal(selected[2].source_id,'2'); assert.equal(selected[2].price,'100');
  assert.deepEqual({existing,sources},before);
  assert.deepEqual(addPublicCatalogCards(selected,sources,'menus','Eventos'),selected);
  assert.equal(addPublicCatalogCards([],Array.from({length:80},(_,i)=>({id:String(i),name:`Menu ${i}`})),'menus','Events').length,60);
});

test('WhatsApp normalizes international numbers and official links; rejects local-only or unsafe input', () => {
  for (const input of ['+502 5555-4444','00502 5555 4444','https://wa.me/50255554444','wa.me/50255554444?text=Old','https://api.whatsapp.com/send?phone=%2B50255554444']) assert.equal(whatsappNumber(input),'50255554444');
  assert.equal(whatsappNumber('+1 (803) 555-1234'),'18035551234');
  assert.equal(whatsappNumber('+52 55 1234 5678'),'525512345678');
  for (const input of ['55554444','150246074408','javascript:alert(1)','https://evil.test/50255554444','https://wa.me@evil.test/50255554444','https://wa.me/message/abcd','']) assert.equal(whatsappNumber(input),'');
  const content={whatsapp:'https://wa.me/50255554444',phone:'',email:''};
  assert.equal(contactLink('whatsapp',content,'Hola & más'), 'https://wa.me/50255554444?text=Hola%20%26%20m%C3%A1s');
  assert.equal(cleanContent(content).whatsapp,'50255554444');
});

test('direct official links preserve business codes and messages; unsupported or unsafe links are rejected', () => {
  const good=['https://wa.me/message/ABC123xyz?text=Hola%20mundo','https://api.whatsapp.com/message/ABC123xyz', 'https://wa.me/50255554444?text=Hola%20mundo', 'https://api.whatsapp.com/send?phone=%2B50255554444&text=Hola'];
  for(const url of good){assert.equal(officialWhatsAppLink(url),url);assert.equal(contactLink('whatsapp',{whatsapp_link:url,whatsapp:'50211112222'},'Another message'),url);assert.equal(cleanContent({whatsapp_link:url}).whatsapp_link,url);}
  assert.equal(officialWhatsAppLink(' wa.me/message/ABC123xyz '),'https://wa.me/message/ABC123xyz');
  for(const url of ['https://wa.me.evil.test/message/ABC123','https://wa.me@evil.test/message/ABC123','javascript:alert(1)','https://wa.me/message/abc','https://wa.me/message/ABC123#hash','https://api.whatsapp.com/send?phone=123','https://example.test/wa.me/message/ABC123']) {
   assert.equal(officialWhatsAppLink(url),'');assert.equal(contactLink('whatsapp',{whatsapp_link:url,whatsapp:'50255554444'}),'');
  }
});

test('the reported username link works with HTTP, HTTPS or no scheme and keeps its message',()=>{
 for(const input of ['http://wa.me/entrebrasasgt','https://wa.me/entrebrasasgt','wa.me/entrebrasasgt',' HTTP://WA.ME/entrebrasasgt ']){
  const expected='https://wa.me/entrebrasasgt';
  assert.equal(officialWhatsAppLink(input),expected);
  assert.equal(contactLink('whatsapp',{whatsapp_link:input,whatsapp:'50255554444'}),expected);
  assert.equal(cleanContent({whatsapp_link:input}).whatsapp_link,expected);
 }
 assert.equal(officialWhatsAppLink('http://wa.me/entrebrasasgt?text=Hola%20%26%20gracias'),'https://wa.me/entrebrasasgt?text=Hola%20%26%20gracias');
 assert.equal(officialWhatsAppLink('http://wa.me/message/ABC123'),'https://wa.me/message/ABC123');
 assert.equal(officialWhatsAppLink('https://wa.me/mesa.gt_2'),'https://wa.me/mesa.gt_2');
 for(const input of ['https://wa.me/123','https://wa.me/','https://wa.me/entrebrasasgt/extra','https://evil.test/entrebrasasgt','https://wa.me@evil.test/entrebrasasgt','ftp://wa.me/entrebrasasgt','http://wa.me:81/entrebrasasgt','https://wa.me/entrebrasasgt#fragment'])assert.equal(officialWhatsAppLink(input),'');
});

test('native contact links use existing navigation handler, browsers retain the original page', () => {
 for(const url of ['https://wa.me/message/ABC123','/menus/restaurant/file/menu.pdf']) {assert.equal(nativeContactTarget(false,url),'_blank');assert.equal(nativeContactTarget(true,url),undefined);}
 for(const url of ['mailto:events@example.test','tel:+50255554444']) assert.equal(nativeContactTarget(false,url),undefined);
});

test('public maximum capacity is an explicit positive integer, never inferred from seats',()=>{
 for(const [value,expected] of [['80',80],[' 120 ',120],['100000',100000],['',null],['0',null],['-3',null],['20.5',null],['100001',null],['80 personas',null]])assert.equal(maximumGuests(value),expected);
});

test('PDF addresses use the app origin and a readable filename, including existing uploads', () => {
  assert.equal(publicPdfUrl(pdfPath,'Menú de Eventos.pdf'),`/menus/${restaurant}/${file}/menu-de-eventos.pdf`);
  assert.equal(publicPdfUrl('https://supabase.test/file.pdf','Menu'),'');
  assert.equal(publicPdfUrl(`${restaurant}/../private.pdf`,'Menu'),'');
  assert.equal(publicPdfUrl(pdfPath,'../../\r\n"<>'),`/menus/${restaurant}/${file}/menu.pdf`);
});

test('PDF proxy serves public bytes without redirect, credentials or provider metadata; bounds errors', async t => {
  const priorFetch=global.fetch, priorURL=process.env.NEXT_PUBLIC_SUPABASE_URL;
  let calls=[],mode='ok'; process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.test';
  global.fetch=async(url,options)=>{calls.push({url:String(url),options});
    if(mode==='missing')return new Response('missing',{status:404});
    if(mode==='redirect')return new Response(null,{status:302,headers:{Location:'https://untrusted.test'}});
    if(mode==='too-large')return new Response('%PDF-test',{headers:{'Content-Length':String(4*1024*1024)}});
    if(mode==='large-stream')return new Response(new Uint8Array(3*1024*1024+1));
    if(mode==='html')return new Response('<script>not a pdf</script>');
    return new Response('%PDF-1.4\nfixture',{headers:{'Content-Type':'application/pdf','Server':'provider'}});
  };
  const params={restaurant,file,name:'menu-eventos.pdf'};
  const request=()=>GET(new Request('https://www.unomesa.com/menus/test'),{params:Promise.resolve(params)});
  try {
    let response=await request(); assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'application/pdf');
    assert.equal(response.headers.get('location'),null); assert.equal(response.headers.get('server'),null);
    assert.equal(response.headers.get('content-disposition'),'inline; filename="menu-eventos.pdf"');
    assert.equal(await response.text(),'%PDF-1.4\nfixture');
    assert.equal(calls[0].url,`https://fixture.supabase.test/storage/v1/object/public/unomesa-public/${pdfPath}`);
    assert.equal(calls[0].options.redirect,'error'); assert.equal(calls[0].options.headers,undefined);
    const before=calls.length;
    for(const bad of [{restaurant:'../private'},{file:'https://evil.test'},{name:'bad\r\n.pdf'}]) assert.equal((await GET(new Request('https://www.unomesa.com'),{params:Promise.resolve({...params,...bad})})).status,404);
    assert.equal(calls.length,before);
    for(const [scenario,status] of [['missing',404],['redirect',502],['too-large',502],['large-stream',502],['html',502]]){mode=scenario;response=await request();assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');}
  } finally {global.fetch=priorFetch;if(priorURL===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=priorURL;}
});
