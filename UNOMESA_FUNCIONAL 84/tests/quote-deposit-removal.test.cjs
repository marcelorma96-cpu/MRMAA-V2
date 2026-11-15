require('tsx/cjs');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {setup} = require('./helpers/event-area-database.cjs');
const {rid,id,save,rpc,snapshot,quote,floor,payload} = require('./helpers/floor-database.cjs');
const {saveQuote} = require('../lib/quote-data.ts');
const {calculateQuote} = require('../lib/calculations.ts');

test('saving a removed deposit clears the quote and its linked reservation, preserving the event and other deposits', async()=>{
  const db = await setup();
  try {
    const items=[{name:"Menú",description:"",quantity:11,unit_price:256}];
    const totals=calculateQuote(items,0,10,1239.04);
    const event=payload({subtotal:totals.subtotal,total:totals.total,tip_pct:10,deposit:totals.deposit,balance:totals.balance,payment_method:"transferencia",area_ids:[]});
    await save(db,1,payload(),floor([],{plan_revision:2}));
    const q=await quote(db,null,floor([],{plan_revision:2}),event);
    await rpc(db,'v2_link_existing_events',[rid,id(1),q.id,false,false]);
    const unrelated=await quote(db,null,floor([],{plan_revision:2}),{...event,deposit:300});
    const previous=await snapshot(db);
    assert.equal(previous.quotes.find(row=>row.id===q.id).deposit,1239.04);
    assert.equal(previous.reservations.find(row=>row.id===id(1)).deposit,1239.04);
    const empty=calculateQuote(items,0,10,0);
    const client={rpc:async(name,args)=>({data:await rpc(db,name,[args.p_restaurant,args.p_quote_id,args.p_request_id,args.p_payload,args.p_items,args.p_reservation,args.p_floor]),error:null})};
    await saveQuote(client,rid,q.id,{...event,deposit:empty.deposit,payment_method:"",balance:empty.balance},items,null,null,null);
    const after=await snapshot(db);
    const updated=after.quotes.find(row=>row.id===q.id), linked=after.reservations.find(row=>row.id===id(1));
    for(const row of [updated,linked]){
      assert.equal(row.deposit,0);assert.equal(row.payment_method,"");assert.equal(row.balance,3097.60);
    }
    assert.equal(linked.quote_id,q.id);
    assert.equal(after.quotes.length,previous.quotes.length);
    assert.equal(after.reservations.length,previous.reservations.length);
    assert.deepEqual(after.quotes.find(row=>row.id===unrelated.id),previous.quotes.find(row=>row.id===unrelated.id));
  } finally {await db.close();}
});
