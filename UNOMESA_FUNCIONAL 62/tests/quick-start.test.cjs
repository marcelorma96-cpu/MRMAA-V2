require('tsx/cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quickStartSteps, parseQuickStart, mergeQuickStart, quickStartMetadataKey, quickStartStorageKey, saveQuickStart } = require('../lib/quick-start.ts');
const progress = (status, updatedAt=1) => ({status, step:'quotes', updatedAt});

test('quick start covers core features within five minutes and respects plan/role access', () => {
  for (const en of [false, true]) {
    const basic = quickStartSteps(en,'basic','administrador','activo');
    assert.deepEqual(basic.map(s=>s.id), ['reservations','floor','quotes','clients']);
    const advanced = quickStartSteps(en,'advanced','administrador','activo');
    assert.equal(advanced.reduce((sum,s)=>sum+s.seconds,0),300);
    assert.deepEqual(advanced.slice(-2).map(s=>s.id),['schedules','reports']);
    for(const role of ['gerente','operacion','lectura']) {
      assert(!quickStartSteps(en,'advanced',role,'activo').some(s=>s.id==='reports'));
      assert(quickStartSteps(en,'advanced',role,'activo').some(s=>s.id==='schedules'));
    }
    assert.deepEqual(quickStartSteps(en,'advanced','administrador','inactivo'),[]);
    assert.deepEqual(quickStartSteps(en,'advanced','soporte_editor','activo'),[]);
  }
});
test('read-only instructions do not suggest creating or assigning records',()=>{
  const read=quickStartSteps(true,'advanced','lectura','activo');
  assert(!read.flatMap(s=>s.instructions).join(' ').includes('Use New'));
  assert(read.find(s=>s.id==='schedules').instructions[1].includes('administrator or manager'));
});
test('completed preferences cannot be revived by an older active/dismissed device; malformed state is ignored',()=>{
  for(const [a,b] of [[progress('completed'),progress('active',10)],[progress('dismissed',10),progress('completed')]]) assert.equal(mergeQuickStart(a,b).status,'completed');
  assert.equal(mergeQuickStart(progress('active',2),progress('dismissed',3)).status,'dismissed');
  for(const value of [null,'{}',{}, {status:'unknown',step:'quotes',updatedAt:1}, {status:'active',step:'billing',updatedAt:1}, {status:'completed',step:'quotes',updatedAt:NaN}]) assert.equal(parseQuickStart(value),null);
});
test('preference persistence is isolated per account and restaurant; existing metadata is not replaced',async()=>{
  const metadata={role:'untouched', [quickStartMetadataKey('other')]:progress('active')};
  let sent;
  const client={auth:{getUser:async()=>({data:{user:{id:'one'}},error:null}),updateUser:async(payload)=>{sent=payload;Object.assign(metadata,payload.data);return{error:null}}}};
  await saveQuickStart(client,'one','restaurant',progress('completed'));
  assert.deepEqual(Object.keys(sent.data),[quickStartMetadataKey('restaurant')]);
  assert.equal(metadata.role,'untouched');assert.equal(metadata[quickStartMetadataKey('other')].status,'active');
  assert.notEqual(quickStartStorageKey('one','restaurant'),quickStartStorageKey('two','restaurant'));
  assert.notEqual(quickStartStorageKey('one','restaurant'),quickStartStorageKey('one','other'));
});
test('session mismatch and remote save failure cannot report successful completion',async()=>{
  let writes=0;
  const auth={getUser:async()=>({data:{user:{id:'different'}},error:null}),updateUser:async()=>{writes++;return{error:new Error('offline')}}};
  await assert.rejects(saveQuickStart({auth},'one','restaurant',progress('completed')),/SESSION/);assert.equal(writes,0);
  auth.getUser=async()=>({data:{user:{id:'one'}},error:null});
  await assert.rejects(saveQuickStart({auth},'one','restaurant',progress('completed')),/offline/);
});
test('skipping from a stale session preserves completion already saved on another device',async()=>{
  const completed=progress('completed',1);
  let sent;
  const auth={getUser:async()=>({data:{user:{id:'one',user_metadata:{[quickStartMetadataKey('restaurant')]:completed}}},error:null}),updateUser:async(payload)=>{sent=payload;return{error:null}}};
  const saved=await saveQuickStart({auth},'one','restaurant',progress('dismissed',10));
  assert.equal(saved.status,'completed');
  assert.equal(sent.data[quickStartMetadataKey('restaurant')].status,'completed');
});
