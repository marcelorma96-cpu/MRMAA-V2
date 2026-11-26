require('tsx/cjs');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculateQuoteWithAdjustments: totals} = require('../lib/calculations.ts');
const {depositTerms, suggestedDeposit, quoteDepositFields, validDepositRate, documentDepositDue, depositDueCaption, showDepositDue} = require('../lib/quote-deposit.ts');
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
test('rate stays with the quote; old and new quotes use this restaurant’s current tip basis',()=>{
  const first={quote_deposit_suggestion_pct:'12.50',quote_deposit_suggestion_basis:'with_tip'};
  const second={quote_deposit_suggestion_pct:0,quote_deposit_suggestion_basis:'without_tip'};
  const fields=quoteDepositFields({event:'anniversary'},depositTerms(first));
  assert.deepEqual(depositTerms(second,{...fields,_unomesa_deposit_basis:'with_tip'}),{rate:12.5,basis:'without_tip'});
  assert.deepEqual(depositTerms(first,{...fields,_unomesa_deposit_basis:'without_tip'}),{rate:12.5,basis:'with_tip'});
  assert.ok(!('_unomesa_deposit_basis' in quoteDepositFields({...fields,_unomesa_deposit_basis:'without_tip'},depositTerms(first))));
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

test('any received deposit suppresses the customer notice regardless of rate, basis or visibility',()=>{
  const items=[{quantity:1,unit_price:2340}];
  const screenshot=totals(items,0,10,950);
  assert.equal(screenshot.balance,1624);
  assert.equal(suggestedDeposit(screenshot,{rate:40,basis:'with_tip'}),1029.60);
  for(const amount of [.01,950,1029.59,1029.60,1500,2574]){
    const t=totals(items,0,10,amount);
    for(const basis of ['with_tip','without_tip']) for(const rate of [1,40,100]) for(const visible of [true,false]){
      assert.equal(documentDepositDue(t,{quote_deposit_suggestion_basis:basis,quote_show_deposit_due:visible},{_unomesa_deposit_rate:String(rate)}),0);
    }
    assert.equal(t.deposit,amount);
    assert.equal(+t.balance.toFixed(2),+(2574-amount).toFixed(2));
  }
});
test('without a recorded payment, including after removal, respect the quote rate and restaurant visibility',()=>{
  const t=totals([{quantity:1,unit_price:2340}],0,10,0);
  const settings={quote_deposit_suggestion_basis:'with_tip'};
  assert.equal(documentDepositDue(t,settings),1029.60);
  assert.equal(documentDepositDue(t,{quote_deposit_suggestion_basis:'without_tip'}),936);
  assert.equal(documentDepositDue(t,{...settings,quote_show_deposit_due:false}),0);
  assert.equal(showDepositDue({quote_show_deposit_view:false}),false);
  assert.equal(showDepositDue({quote_show_deposit_view:false,quote_show_deposit_due:true}),true);
  assert.equal(documentDepositDue(t,settings,{_unomesa_deposit_rate:'0'}),0);
});

test('pending deposit shows its actual share of the current balance, separately from the agreed rate when different',()=>{
  const gross={rate:40,basis:'with_tip'},net={rate:40,basis:'without_tip'};
  assert.deepEqual(depositDueCaption(1239.04,3097.60,gross,false),['40% del saldo pendiente · con propina']);
  assert.deepEqual(depositDueCaption(1126.40,3097.60,net,true),['36.36% of the outstanding balance','Agreed deposit: 40% without tip']);
  assert.equal(depositDueCaption(.01,1858.57,gross,true)[0],'<0.01% of the outstanding balance');
  assert.deepEqual(depositDueCaption(0,1858.56,gross,false),[]);
});
