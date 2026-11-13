require('tsx/cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const descriptions=require('../lib/public-description.ts');
const restaurantPublic=require('../lib/restaurant-public.ts');
const {cleanContent}=restaurantPublic;
const rid='22222222-2222-4222-8222-222222222222',uid='33333333-3333-4333-8333-333333333333',requestId='44444444-4444-4444-8444-444444444444';
const original={name:'Restaurante Prueba',description:'Cocina y eventos.',language:'es',currency:'Q',channels:[],quotes:true,menus:[{id:'menu',source_id:uid,name:'Menú 1',description:'Pollo con dos guarniciones.',price:'130',category:'Eventos'}],areas:[{id:'room',name:'Jardín',description:'Salón con terraza.',capacity:'100'}],pdfs:[]};
function moduleFrom(file,imports,extra={}){
 const module={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{module,exports:module.exports,require:name=>Object.hasOwn(imports,name)?imports[name]:require(name),process,Buffer,AbortSignal,Error,console,...extra},{filename:file});
 return module.exports;
}

test('adding English preserves original descriptions, identifiers, prices and all other content',()=>{
 const before=structuredClone(original),base=cleanContent(original);
 assert.equal(Object.hasOwn(base,'description_en'),false);
 const bilingual=cleanContent({...base,description_en:'Food and events.',menus:base.menus.map(x=>({...x,description_en:'Chicken with two side dishes.'})),areas:base.areas.map(x=>({...x,description_en:'Room with a terrace.'}))});
 assert.equal(descriptions.publicDescription(bilingual,'es'),base.description);
 assert.equal(descriptions.publicDescription(bilingual,'en'),'Food and events.');
 for(const kind of ['menus','areas'])for(let i=0;i<base[kind].length;i++){
  const {description_en,...rest}=bilingual[kind][i];assert.deepEqual(rest,base[kind][i]);assert(description_en);
 }
 assert.deepEqual(cleanContent(bilingual),bilingual);assert.deepEqual(original,before);
 assert.equal(descriptions.publicDescription({description:'Original',description_en:'  '},'en'),'Original');
 assert.equal(descriptions.publicDescription({description:'Original'},'en'),'Original');
});

test('actual public page renders the chosen language for the restaurant, menus and spaces',()=>{
 const {RestaurantPublicPage}=moduleFrom('components/restaurant-public-page.tsx',{
  '@/lib/restaurant-public':restaurantPublic,'@/lib/public-description':descriptions,'@/lib/legal-routes':{legalHref:()=>'/privacy'},
  './public-pdf-viewer':{},'@/lib/pdf-book':{},'@/lib/public-request-feedback':{},'./public-request-phone':{},'./contact-link':{},'./access-verification':{},'./restaurant-public.module.css':{},
 });
 const content=cleanContent({...original,description_en:'Food and events.',menus:original.menus.map(x=>({...x,description_en:'Chicken with two side dishes.'})),areas:original.areas.map(x=>({...x,description_en:'Room with a terrace.'}))});
 for(const language of ['es','en']){
  const html=renderToStaticMarkup(React.createElement(RestaurantPublicPage,{slug:'prueba',content:{...content,language}}));
  for(const value of [content,...content.menus,...content.areas]){
   assert(html.includes(`<p>${descriptions.publicDescription(value,language)}</p>`));
   assert(!html.includes(`<p>${descriptions.publicDescription(value,language==='es'?'en':'es')}</p>`));
  }
  assert(html.includes('Q 130'));assert(html.includes('Menú 1'));assert(html.includes('Jardín'));
 }
 const fallback=renderToStaticMarkup(React.createElement(RestaurantPublicPage,{slug:'prueba',content:cleanContent({...original,language:'en'})}));
 assert(fallback.includes('<p>Cocina y eventos.</p>'));
});

test('translation requests and responses are bounded and never silently truncate food details',()=>{
 for(const [input,max] of [['',1000],['x'.repeat(1001),1000],['x'.repeat(1501),1500],[{},1000],['Text',8000]])assert.throws(()=>descriptions.descriptionTranslationInput(input,max),/AI_INPUT/);
 assert.equal(descriptions.descriptionTranslationInput('Original',1000).question,'Original');
 assert.throws(()=>descriptions.validateDescriptionTranslation('x'.repeat(1001),1000),/AI_PROVIDER/);
 assert.throws(()=>descriptions.validateDescriptionTranslation('',1000),/AI_PROVIDER/);
});

test('existing public-page SQL saves and reloads both languages without changing business records',async()=>{
 const {database,rpc,snapshot,rid}=require('./helpers/floor-database.cjs');
 const db=await database();
 try{
  await db.exec('create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');
  await db.exec(fs.readFileSync('50_PAGINA_PUBLICA.sql','utf8'));
  const before=await snapshot(db),base=cleanContent({...original,channels:['email'],email:'events@example.test'});
  const first=await rpc(db,'v2_public_save',[rid,'bilingual-test',base,true,0]);
  const translated={...base,description_en:'Food and events.',menus:base.menus.map(x=>({...x,description_en:'Chicken with two side dishes.'})),areas:base.areas.map(x=>({...x,description_en:'Room with a terrace.'}))};
  await rpc(db,'v2_public_save',[rid,'bilingual-test',translated,true,first.revision]);
  const published=await rpc(db,'v2_public_page',['bilingual-test']);
  assert.deepEqual(cleanContent(published.content),translated);assert.deepEqual(await snapshot(db),before);
  assert.equal(published.content.description,base.description);assert.equal(published.content.menus[0].price,base.menus[0].price);
 }finally{await db.close()}
});

function apiFixture(options={}){
 const calls=[],writes=[];
 const client={auth:{getUser:async()=>({data:{user:{id:uid,email_confirmed_at:'2026-01-01'}},error:null})},
  from:table=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{role:'administrador',status:'activo'}})}),maybeSingle:async()=>({data:{plan_code:'advanced'}})})})}),
  rpc:async(name,args)=>{calls.push({name,args});return name==='v2_public_settings'?{error:options.denied?{message:'PUBLIC_ACCESS'}:null}:{data:true};},
 };
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='v2_take_rate_limit'?true:(options.quota||{state:'reserved',used:1,limit:50})};},
  from:table=>({update:data=>{writes.push({table,data});const chain={eq:()=>chain,select:async()=>({data:[{request_id:requestId}]})};return chain;}}),
 };
 const api=moduleFrom('app/api/assistant/route.ts',{
  'next/server':{NextResponse:{json:(value,init)=>Response.json(value,init)}},
  '@/lib/billing-server':{serverClients:()=>({admin,client}),requestBody:req=>req.json()},
  '@/lib/mfa':{requireVerifiedMfa:async()=>{if(options.mfa)throw Error('MFA')}},
  '@/lib/permissions':require('../lib/permissions.ts'),'@/lib/assistant':require('../lib/assistant.ts'),
  '@/lib/public-description':descriptions,
 },{fetch:async(url,init)=>{
  calls.push({name:'provider',url,init});
  if(options.providerError)return Response.json({error:'bad'},{status:502});
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:options.answer||'Chicken with two side dishes.'}]}]});
 }});
 return {calls,writes,run:patch=>api.POST(new Request('https://example.test/api/assistant',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({restaurant_id:rid,request_id:requestId,mode:'public-description-translation',question:original.menus[0].description,max_length:1000,...patch})}))};
}

test('translation uses existing AI quota, requires public-page management, and writes only its AI result',async()=>{
 const previous=process.env.OPENAI_API_KEY,enabled=process.env.MRMAA_AI_ENABLED;process.env.OPENAI_API_KEY='fixture';delete process.env.MRMAA_AI_ENABLED;
 try{
  const f=apiFixture(),response=await f.run();assert.equal(response.status,200);assert.equal((await response.json()).answer,'Chicken with two side dishes.');
  const manage=f.calls.findIndex(x=>x.name==='v2_public_settings'),quota=f.calls.findIndex(x=>x.name==='v2_ai_quota'),provider=f.calls.findIndex(x=>x.name==='provider');
  assert(manage>=0&&quota>manage&&provider>quota);
  const payload=JSON.parse(f.calls[provider].init.body);assert.equal(payload.store,false);assert.equal(payload.input.length,1);assert.equal(payload.input[0].content,original.menus[0].description);assert.equal(payload.instructions,descriptions.DESCRIPTION_TRANSLATION_INSTRUCTIONS);
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].table,'v2_ai_requests');assert.equal(f.writes[0].data.status,'done');
  for(const options of [{denied:true},{mfa:true}]){const blocked=apiFixture(options);assert.equal((await blocked.run()).status,403);assert(!blocked.calls.some(x=>x.name==='provider'||x.name==='v2_ai_quota'));assert.equal(blocked.writes.length,0)}
  const limited=apiFixture({quota:{state:'limit'}});assert.equal((await limited.run()).status,429);assert(!limited.calls.some(x=>x.name==='provider'));
  const repeated=apiFixture({quota:{state:'done',answer:'Saved translation.'}});assert.equal((await (await repeated.run()).json()).answer,'Saved translation.');assert(!repeated.calls.some(x=>x.name==='provider'));assert.equal(repeated.writes.length,0);
  for(const options of [{providerError:true},{answer:'x'.repeat(1001)}]){const failed=apiFixture(options);assert.equal((await failed.run()).status,502);assert.equal(failed.writes[0].data.status,'failed');assert(!failed.writes.some(x=>x.table!=='v2_ai_requests'))}
  const invalid=apiFixture();assert.equal((await invalid.run({question:'x'.repeat(1501)})).status,400);assert.equal(invalid.calls.length,0);
  const help=apiFixture();assert.equal((await help.run({mode:undefined,question:'¿Cómo creo una reserva?',history:[],language:'es'})).status,200);assert(!help.calls.some(x=>x.name==='v2_public_settings'));assert.notEqual(JSON.parse(help.calls.find(x=>x.name==='provider').init.body).instructions,descriptions.DESCRIPTION_TRANSLATION_INSTRUCTIONS);
 }finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;if(enabled===undefined)delete process.env.MRMAA_AI_ENABLED;else process.env.MRMAA_AI_ENABLED=enabled}
});
