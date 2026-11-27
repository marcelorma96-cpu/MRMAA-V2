const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const Module = require('node:module');

// Real React, CSS and Chromium; only access/data completion is synthetic.
// No credentials, restaurant records or external services are used.
test('mobile startup stays silent until both access and initial data are ready', { timeout:60000 }, async t => {
  if (process.env.UNOMESA_RUN_BROWSER_TESTS !== '1') {
    t.skip('Opt in with UNOMESA_RUN_BROWSER_TESTS=1 in an environment permitting Chromium'); return;
  }
  const root = process.env.UNOMESA_AUTH_TEST_ROOT || path.resolve(__dirname, '..');
  const requireApp = Module.createRequire(path.join(root, 'package.json'));
  let esbuild, playwright;
  try { esbuild = requireApp('esbuild'); playwright = require('playwright'); }
  catch { t.skip('Requires esbuild and Playwright for real-browser verification'); return; }
  const executablePath = process.env.UNOMESA_BROWSER_EXECUTABLE || playwright.chromium.executablePath();
  if (!fs.existsSync(executablePath)) { t.skip('Chromium executable is unavailable'); return; }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'startup-loading-'));
  const write = (name, value) => { const file = path.join(temp, name); fs.writeFileSync(file, value); return file; };
  const fixture = write('fixture.tsx', `
import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OpeningCover, AccessLoading, EntryReady, SignedInOpening } from '@/components/app-launch';
import { StartupLoadingProvider, AppModuleBoundary } from '@/components/presentation-loading';
import { ENTRY_PRESENTATION_SCRIPT } from '@/lib/entry-presentation';
import '@/app/app-polish.css';
import '@/app/surface-motion.css';
import '@/app/signed-in-opening.css';
localStorage.setItem('unomesa-app:sb-test-auth-token', JSON.stringify({access_token:'synthetic-test-token'}));
(0, eval)(ENTRY_PRESENTATION_SCRIPT);
document.documentElement.dataset.unomesaApp = 'true';
const qa:any = (window as any).qa = { clicks:0, mounted:false };
function App() {
  const [access, setAccess] = useState(false), [data, setData] = useState(false);
  useLayoutEffect(() => { Object.assign(qa, { access:setAccess, data:setData, mounted:true }); }, []);
  return <><OpeningCover/><StartupLoadingProvider><EntryReady enabled/>{!access
    ? <AccessLoading text="Cargando UnoMesa…"/>
    : <><SignedInOpening user="synthetic-user"/><AppModuleBoundary pending={!data}>
        <main data-testid="protected-surface"><h1>Restaurante de prueba</h1>
          <button onClick={() => qa.clicks++}>Acción privada</button>
          <input aria-label="Borrador de prueba" defaultValue="Texto conservado"/>
        </main>
      </AppModuleBoundary></>}
  </StartupLoadingProvider></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
`);
  const candidates = file => [file, file+'.ts', file+'.tsx', file+'.css'].find(f => fs.existsSync(f));
  await esbuild.build({
    entryPoints:[fixture], bundle:true, outdir:temp, entryNames:'bundle', format:'iife', platform:'browser', jsx:'automatic',
    nodePaths:[path.join(root,'node_modules')], define:{'process.env.NODE_ENV':'"development"'}, logLevel:'silent',
    plugins:[{name:'application-alias', setup(build) {
      build.onResolve({filter:/^@\//}, args => { const file = candidates(path.join(root,args.path.slice(2))); return file ? {path:file} : undefined; });
    }}]
  });
  write('index.html', '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"></head><body style="margin:0"><div id="root"></div><script src="/bundle.js"></script></body></html>');
  const server = http.createServer((request,response) => {
    const pathname = new URL(request.url,'http://localhost').pathname;
    const name = pathname === '/mobile' ? 'index.html' : path.basename(pathname);
    const file = path.join(temp,name);
    if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = 'http://127.0.0.1:'+server.address().port;
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp,{recursive:true,force:true});
  });
  browser = await playwright.chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
  for (const platform of ['iOS','Android']) for (const reduced of [false,true]) {
    await t.test(platform+' long access/data wait; reduced motion '+reduced, async () => {
      const context = await browser.newContext({
        viewport:platform==='iOS'?{width:390,height:844}:{width:412,height:915},
        userAgent:platform==='iOS'?'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 UnoMesa-iOS/1.0':'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 UnoMesa-Android/1.0',
        isMobile:true,hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'
      });
      try {
        await context.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
        const page = await context.newPage(), errors = [];
        page.on('pageerror',error => errors.push(error.message));
        await page.clock.install();
        await page.goto(url+'/mobile');
        await page.waitForFunction(() => window.qa?.mounted);
        await page.clock.runFor(100);
        const cover = page.locator('#unoOpening');
        const assertSilentHold = async () => {
          assert.equal(await page.evaluate(() => document.documentElement.dataset.unoOpening),'hold');
          assert.equal(await cover.isVisible(),true);
          assert.equal(await cover.locator('button').count(),0,'loading curtain has no delayed retry action');
          assert.doesNotMatch(await cover.textContent(),/tardando|taking longer|server|servidor|reintentar|retry/i);
          assert.doesNotMatch(await page.locator('body').innerText(),/tardando|taking longer|server|servidor|reintentar|retry|reconectando|sin conexión/i);
          assert.equal(await page.evaluate(() => !!document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#unoOpening')),true,'curtain covers the interactive surface');
        };
        await assertSilentHold();
        await page.clock.fastForward(45000);
        await assertSilentHold();
        assert.equal(await page.getByTestId('protected-surface').count(),0,'private tree is not mounted before authorization');
        await page.evaluate(() => window.qa.access(true));
        await page.clock.runFor(100);
        await page.getByTestId('protected-surface').waitFor({state:'attached'});
        await assertSilentHold();
        assert.equal(await page.getByTestId('protected-surface').isVisible(),false,'initial data remains hidden');
        assert.equal(await page.locator('.appModuleContent').evaluate(el => el.inert),true);
        await page.clock.fastForward(45000);
        await assertSilentHold();
        await page.mouse.click(195,100);
        assert.equal(await page.evaluate(() => window.qa.clicks),0);
        await page.evaluate(() => window.qa.data(true));
        await page.clock.runFor(1600);
        await cover.waitFor({state:'hidden'});
        assert.equal(await page.getByTestId('protected-surface').isVisible(),true);
        assert.equal(await page.locator('.appModuleContent').evaluate(el => el.inert),false);
        await page.getByRole('button',{name:'Acción privada'}).click();
        assert.equal(await page.evaluate(() => window.qa.clicks),1);
        await page.getByRole('textbox',{name:'Borrador de prueba'}).fill('Borrador conservado al volver');
        await page.evaluate(() => {
          window.qa.original = document.querySelector('[aria-label="Borrador de prueba"]');
          window.dispatchEvent(new Event('blur'));
          window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
          window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('focus'));
          window.qa.data(false);
        });
        await page.clock.runFor(100);
        assert.equal(await cover.isVisible(),false,'resume and refresh do not replay the opening');
        assert.equal(await page.getByTestId('protected-surface').isVisible(),true);
        assert.equal(await page.evaluate(() => window.qa.original === document.querySelector('[aria-label="Borrador de prueba"]')),true);
        assert.equal(await page.getByRole('textbox',{name:'Borrador de prueba'}).inputValue(),'Borrador conservado al volver');
        assert.deepEqual(errors,[]);
      } finally { await context.close(); }
    });
  }
});
