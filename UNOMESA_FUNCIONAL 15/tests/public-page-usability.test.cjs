require('tsx/cjs');
const test = require('node:test'), assert = require('node:assert/strict');
const {addPublicCatalogCards} = require('../lib/public-catalog.ts');
const {whatsappNumber, openPublicContact} = require('../lib/public-contact.ts');
const {publicPdfUrl, contactLink, cleanContent} = require('../lib/restaurant-public.ts');
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

test('WhatsApp opens by user gesture; popup blocks and native navigation keep separate paths', () => {
  const priorWindow=global.window, priorNavigator=Object.getOwnPropertyDescriptor(global,'navigator');
  let navigation=[],opened=[],popup={opener:'source',location:{replace:url=>opened.push(url)}};
  const url=contactLink('whatsapp',{whatsapp:'50255554444'},'Test');
  try {
    Object.defineProperty(global,'navigator',{configurable:true,value:{userAgent:'Web browser'}});
    global.window={open:()=>popup,location:{assign:url=>navigation.push(url)}};
    assert.equal(openPublicContact(url),true); assert.equal(popup.opener,null); assert.deepEqual(opened,[url]); assert.deepEqual(navigation,[]);
    global.window.open=()=>null; assert.equal(openPublicContact(url),false); assert.deepEqual(navigation,[]);
    Object.defineProperty(global,'navigator',{configurable:true,value:{userAgent:'UnoMesa-iOS/1.0.14'}});
    assert.equal(openPublicContact(url),true); assert.deepEqual(navigation,[url]);
    assert.equal(openPublicContact('https://evil.test'),false);
  } finally {global.window=priorWindow; if(priorNavigator)Object.defineProperty(global,'navigator',priorNavigator);else delete global.navigator;}
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
