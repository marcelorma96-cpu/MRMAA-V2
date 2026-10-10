const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(name,env={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,URL,URLSearchParams,process:{env},require:n=>load((n.startsWith('@/')?n.slice(2):path.join(path.dirname(name),n))+'.ts',env)});return m.exports;}
test('public query selection preserves authentication callbacks and explicit login/signup',()=>{
 const {requestedAccountEntry:entry}=load('lib/public-entry.ts');assert.equal(entry(''),null);assert.equal(entry('?utm_source=google&gclid=abc','#planes'),null);assert.equal(entry('?login=1'),'login');assert.equal(entry('?signup=1'),'signup');
 for(const query of ['?code=one-time-code','?reset=1','?invite=1','?invitation=id','?support=id','?billing=return'])assert.equal(entry(query),'login');
 for(const hash of ['#access_token=token','#type=recovery','#error=expired'])assert.equal(entry('',hash),'login');
});
test('SEO never invents an origin and uses the configured domain for a public-only sitemap',()=>{
 const env={NEXT_PUBLIC_SITE_URL:'https://public.example/',VERCEL_ENV:'production'},seo=load('lib/public-seo.ts',env);assert.equal(seo.publicSiteOrigin(),'https://public.example');
 const trial=fs.readFileSync(path.join(root,'lib/public-seo.ts'),'utf8').includes('TEST_PROJECT = true');
 const sitemap=load('app/sitemap.ts',env).default();assert.equal(sitemap.length,trial?0:8);
 if(!trial){assert(sitemap.every(x=>x.url.startsWith('https://public.example/')));assert(sitemap.every(x=>!/[?#]|api\/|auth\//.test(x.url)));assert.equal(load('app/robots.ts',env).default().sitemap,'https://public.example/sitemap.xml');}
 for(const raw of ['', 'http://public.example','https://localhost','https://u:password@public.example','https://public.example/?code=secret','https://public.example/path'])assert.equal(load('lib/public-seo.ts',{NEXT_PUBLIC_SITE_URL:raw}).publicSiteOrigin(),null);
 for(const flags of [{VERCEL_ENV:'preview'},{NEXT_PUBLIC_SEARCH_INDEXING:'false'}]){assert.equal(load('lib/public-seo.ts',{...env,...flags}).searchIndexingEnabled(),false);assert.equal(load('app/sitemap.ts',{...env,...flags}).default().length,0);assert.equal(load('app/robots.ts',{...env,...flags}).default().rules.disallow,'/');}
 assert.equal(load('app/sitemap.ts',{}).default().length,0);
});
test('language canonicals, translations and offers match the public pages and real plans',()=>{
 const env={NEXT_PUBLIC_SITE_URL:'https://public.example',VERCEL_ENV:'production'},seo=load('lib/public-seo.ts',env),plans=load('lib/plans.ts',env).PLANS;
 for(const lang of ['en','es']){
  const m=seo.publicMetadata(lang),url='https://public.example'+(lang==='es'?'/es':'/');assert.equal(m.alternates.canonical,url);assert.equal(m.alternates.languages.es,'https://public.example/es');assert.equal(m.openGraph.url,url);assert.equal(m.twitter.card,'summary_large_image');assert.equal(m.openGraph.images[0].width,1200);
  const data=seo.publicStructuredData(lang),app=data['@graph'].find(x=>x['@type']==='SoftwareApplication');assert.equal(app.offers.length,6);assert.equal(app.aggregateRating,undefined);
  for(let i=0;i<plans.length;i++){assert.equal(app.offers[i*2].price,plans[i].monthly);assert.equal(app.offers[i*2+1].price,plans[i].annual)}
  const privateMeta=seo.publicMetadata(lang,true);assert.equal(privateMeta.robots.index,false);assert.equal(privateMeta.alternates.canonical,undefined);
 }
});
test('UnoMesa canonicals agree with the live www host and event pages are discoverable',()=>{
 const env={NEXT_PUBLIC_SITE_URL:'https://unomesa.com',VERCEL_ENV:'production'};
 assert.equal(load('lib/public-seo.ts',env).publicSiteOrigin(),'https://www.unomesa.com');
 const event=load('lib/event-page-seo.ts',env),sitemap=load('app/sitemap.ts',env).default();
 for(const lang of ['es','en']){
  const url='https://www.unomesa.com'+event.EVENT_PATHS[lang],metadata=event.eventPageMetadata(lang);
  assert.equal(metadata.alternates.canonical,url);assert.equal(metadata.openGraph.url,url);
  assert.equal(metadata.alternates.languages.es,'https://www.unomesa.com'+event.EVENT_PATHS.es);
  assert(sitemap.some(item=>item.url===url));
  const structured=event.eventPageStructuredData(lang)['@graph'];
  assert.equal(structured[0].url,url);assert.equal(structured[1].itemListElement[1].item,url);
  assert.equal(load('lib/event-page-seo.ts',{...env,VERCEL_ENV:'preview'}).eventPageMetadata(lang).robots.index,false);
 }
});
test('early presentation covers authentication returns without hiding anonymous public pages',()=>{
 const script=load('lib/entry-presentation.ts').ENTRY_PRESENTATION_SCRIPT;
 function run({path='/',query='',hash='',ua='',token=false}={}){const dataset={},items=token?[['sb-test-auth-token',JSON.stringify({access_token:'synthetic'})]]:[],storage={length:items.length,key:i=>items[i]?.[0],getItem:k=>items.find(x=>x[0]===k)?.[1]||null};vm.runInNewContext(script,{location:{pathname:path,search:query,hash},navigator:{userAgent:ua},document:{documentElement:{dataset}},URLSearchParams,sessionStorage:storage,localStorage:storage});return dataset.unomesaEntryPending;}
 assert.equal(run(),undefined);assert.equal(run({path:'/login'}),'true');assert.equal(run({path:'/es',query:'?utm_source=google'}),undefined);assert.equal(run({query:'?login=1'}),'true');assert.equal(run({hash:'#access_token=synthetic'}),'true');assert.equal(run({token:true}),'true');assert.equal(run({ua:'UnoMesa-iOS/1.0.10'}),'true');assert.equal(run({path:'/auth/google',query:'?code=synthetic'}),undefined);
});
