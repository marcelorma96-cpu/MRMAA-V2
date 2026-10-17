const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/request-alert.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports});
const {requestAlertSettings,requestAlertWav}=m.exports;
test('settings preserve explicit mute, bound volume and validate intervals',()=>{assert.equal(requestAlertSettings().enabled,true);assert.equal(requestAlertSettings().interval,10);assert.equal(requestAlertSettings({enabled:false,volume:0}).volume,0);assert.equal(requestAlertSettings({volume:null}).volume,65);assert.equal(requestAlertSettings({interval:-1,volume:200}).interval,10);assert.equal(requestAlertSettings({volume:200}).volume,100)});
test('WAV has playable PCM header, selected repeat duration and two audible notes',()=>{
 for(const seconds of [1,5,10,20,30]){
  const wav=requestAlertWav(seconds,65),v=new DataView(wav);assert.equal(Buffer.from(wav).subarray(0,4).toString(),'RIFF');assert.equal(v.getUint16(20,true),1);assert.equal(v.getUint32(24,true),16000);assert.equal(wav.byteLength,44+seconds*16000*2);
  const samples=new Int16Array(wav,44);assert(samples.subarray(0,4800).some(v=>Math.abs(v)>5000));assert(samples.subarray(5440,10240).some(v=>Math.abs(v)>5000));assert(samples.subarray(10240).every(v=>v===0));
 }
});
test('muting and volume scaling are baked into PCM for iOS media volume behavior',()=>{
 const zero=new Int16Array(requestAlertWav(1,0),44);assert(zero.every(v=>v===0));const full=new Int16Array(requestAlertWav(1,100),44),half=new Int16Array(requestAlertWav(1,50),44);assert(full.every((v,i)=>Math.abs(v/2-half[i])<=1));assert(Math.max(...full)<32767);
});
