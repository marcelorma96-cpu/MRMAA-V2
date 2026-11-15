require('tsx/cjs');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculateQuoteWithAdjustments: totals} = require('../lib/calculations.ts');
const {depositTerms, suggestedDeposit, quoteDepositFields, validDepositRate} = require('../lib/quote-deposit.ts');
const menu = [{quantity:11,unit_price:256}];
test('40% of the approved quote with or without the tip, independently of payment',()=>{
  const before=totals(menu,0,10,0), after=totals(menu,0,10,1126.40);
  const net=depositTerms({}), gross=depositTerms({quote_deposit_suggestion_basis:'with_tip'});
  for (const t of [before,after]) {
    assert.equal(suggestedDeposit(t,net),1126.40); assert.equal(suggestedDeposit(t,gross),1239.04);
  }
  assert.equal(before.balance,3097.60);
  assert.equal(after.balance.toFixed(2),'1971.20');
});
test('settings are restaurant specific; saved terms and unrelated custom fields survive a default change',()=>{
  const first={quote_deposit_suggestion_pct:'12.50',quote_deposit_suggestion_basis:'with_tip'};
  const second={quote_deposit_suggestion_pct:0,quote_deposit_suggestion_basis:'without_tip'};
  const fields=quoteDepositFields({event:'anniversary'},depositTerms(first));
  assert.deepEqual(depositTerms(second,fields),{rate:12.5,basis:'with_tip'});
  assert.deepEqual(depositTerms(second),{rate:0,basis:'without_tip'});
  assert.equal(fields.event,'anniversary');
});
test('discounts and charges enter the base once; suggestion is in cents and never negative',()=>{
  const t=totals([{quantity:1,unit_price:200}],10,10,20,[{id:'a',kind:'discount',value:5,mode:'fixed'},{id:'b',kind:'charge',value:8,mode:'fixed'}]);
  assert.equal(suggestedDeposit(t,{rate:12.5,basis:'without_tip'}),22.88);
  assert.equal(suggestedDeposit(t,{rate:12.5,basis:'with_tip'}),25.13);
  assert.equal(suggestedDeposit({total:0,tip:10},{rate:100,basis:'without_tip'}),0);
  for(const invalid of [null,'',false,-1,100.01,5.555,Infinity])assert.equal(validDepositRate(invalid),false);
  for(const valid of [0,'0.01','12.50',100])assert.equal(validDepositRate(valid),true);
});
