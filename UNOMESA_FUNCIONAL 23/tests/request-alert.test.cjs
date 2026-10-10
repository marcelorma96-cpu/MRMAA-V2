const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/request-alert.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports});
const {requestAlertSettings,requestChime}=m.exports;
test('defaults and saved settings retain explicit mute and validate interval',()=>{assert.equal(requestAlertSettings().enabled,true);assert.equal(requestAlertSettings().interval,10);assert.equal(requestAlertSettings({enabled:false,volume:0,interval:30}).volume,0);assert.equal(requestAlertSettings({interval:-1,volume:200}).interval,10);assert.equal(requestAlertSettings({volume:200}).volume,100)});
test('no audio when muted or browser suspended',()=>{requestChime({state:'suspended'},65);requestChime({state:'running'},0)});
test('two short notes have finite stops and disconnect on completion',()=>{const stops=[],ended=[],values=[];const c={state:'running',currentTime:10,destination:{},createOscillator(){const o={frequency:{},connect(){},disconnect(){},start(){},stop(t){stops.push(t);ended.push(()=>o.onended())}};return o},createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(v){values.push(v)},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}};requestChime(c,65);assert.equal(stops.length,2);assert(stops.every(t=>t>10&&t<11));assert(values.every(v=>v>0&&v<.2));ended.forEach(f=>f())});
test('repeating audio buffer loops indefinitely with silent gaps and stops cleanly',()=>{
 let source,disconnects=0,stops=0;const context={state:'running',destination:{},createBuffer(channels,length,rate){const samples=new Float32Array(length);return{length,sampleRate:rate,getChannelData:()=>samples}},createBufferSource(){return source={connect(){},start(){},stop(){stops++},disconnect(){disconnects++}}},createGain(){return{gain:{},connect(){},disconnect(){disconnects++}}}};
 const stop=m.exports.startRequestAlert(context,65,5);
 assert.equal(source.loop,true);assert.equal(source.loopEnd,5);assert.equal(source.buffer.length,5*22050);
 const data=source.buffer.getChannelData(0);assert(data.slice(0,12000).some(v=>v!==0));assert(data.slice(12000).every(v=>v===0));assert.equal(stops,0);
 stop();stop();assert.equal(stops,1);assert.equal(disconnects,2);
});
