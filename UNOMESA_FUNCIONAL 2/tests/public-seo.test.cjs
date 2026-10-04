const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(name,env={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,URL,URLSearchParams,process:{env},require:n=>load(n.replace('@/','')+'.ts',env)});return m.exports;}
test('public query selection preserves authentication callbacks and explicit login/signup',()=>{
 const {requestedAccountEntry:entry}=load('lib/public-entry.ts');assert.equal(entry(''),null);assert.equal(entry('?utm_source=google&gclid=abc','#planes'),null);assert.equal(entry('?login=1'),'login');assert.equal(entry('?signup=1'),'signup');
 for(const query of ['?code=one-time-code','?reset=1','?invite=1','?invitation=id','?support=id','?billing=return'])assert.equal(entry(query),'landing');
 for(const hash of ['#access_token=token','#type=recovery','#error=expired'])assert.equal(entry('',hash),'landing');
});
test('SEO never invents an origin and uses the configured domain for a public-only sitemap',()=>{
 const env={NEXT_PUBLIC_SITE_URL:'https://public.example/',VERCEL_ENV:'production'},seo=load('lib/public-seo.ts',env);assert.equal(seo.publicSiteOrigin(),'https://public.example');
 const trial=fs.readFileSync(path.join(root,'lib/public-seo.ts'),'utf8').includes('TEST_PROJECT = true');
 const sitemap=load('app/sitemap.ts',env).default();assert.equal(sitemap.length,trial?0:5);
 if(!trial){assert(sitemap.every(x=>x.url.startsWith('https://public.example/')));assert(sitemap.every(x=>!/[?#]|api\/|auth\//.test(x.url)));assert.equal(load('app/robots.ts',env).default().sitemap,'https://public.example/sitemap.xml');}
 for(const raw of ['', 'http://public.example','https://localhost','https://u:password@public.example','https://public.example/?code=secret','https://public.example/path'])assert.equal(load('lib/public-seo.ts',{NEXT_PUBLIC_SITE_URL:raw}).publicSiteOrigin(),null);
 for(const flags of [{VERCEL_ENV:'preview'},{NEXT_PUBLIC_SEARCH_INDEXING:'false'}]){assert.equal(load('lib/public-seo.ts',{...env,...flags}).searchIndexingEnabled(),false);assert.equal(load('app/sitemap.ts',{...env,...flags}).default().length,0);assert.equal(load('app/robots.ts',{...env,...flags}).default().rules.disallow,'/');}
 assert.equal(load('app/sitemap.ts',{}).default().length,0);
});
