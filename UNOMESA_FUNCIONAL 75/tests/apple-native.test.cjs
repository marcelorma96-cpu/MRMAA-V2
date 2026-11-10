const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{webcrypto}=require('node:crypto');
const src=ts.transpileModule(fs.readFileSync('lib/apple-native.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function run(ua,bridge,iframe=false){const window={navigator:{userAgent:ua},webkit:{messageHandlers:{unoMesaApple:bridge}}};window.top=iframe?{}:window;const exports={};vm.runInNewContext(src,{exports,window,crypto:webcrypto,Uint8Array});return exports;}
test('Apple login requires the native UnoMesa iOS main view, including iPad; never web, Android, an iframe or build 26',()=>{
 const bridge={postMessage(){}};
 for(const [ua,b,iframe,ok] of [['iPhone Safari',bridge,false,false],['iPad Safari',bridge,false,false],['Android UnoMesa-Android/1.0',bridge,false,false],['iPhone UnoMesa-iOS/1.0',null,false,false],['iPad UnoMesa-iOS/1.0',bridge,true,false],['iPhone UnoMesa-iOS/1.0',bridge,false,true],['iPad UnoMesa-iOS/1.0',bridge,false,true]]){
 assert.equal(!!run(ua,b,iframe).appleNativeBridge(),ok,ua);}
});
test('Apple nonce belongs to one presentation; cancellation or missing credentials cannot install a session',async()=>{
 const received=[];const bridge={async postMessage({nonce}){received.push(nonce);return {idToken:'fake-signed-for-test',code:'single-use-from-Apple'};}};
 const {requestAppleCredential}=run('UnoMesa-iOS/1',bridge);
 for(let i=0;i<2;i++){const x=await requestAppleCredential(bridge);assert.equal(x.nonce,received[i]);assert.match(x.nonce,/^[0-9a-f]{64}$/);assert.equal(x.provider,'apple');assert.equal(x.code,'single-use-from-Apple');assert.equal(x.token,'fake-signed-for-test');}
 assert.notEqual(received[0],received[1]);assert.equal(await requestAppleCredential({postMessage:async()=>({cancelled:true})}),null);
 await assert.rejects(requestAppleCredential({postMessage:async()=>({})}),/APPLE_UNAVAILABLE/);
});
