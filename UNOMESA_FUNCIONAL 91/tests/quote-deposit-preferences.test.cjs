const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const {database,rid,other,id,snapshot}=require('./helpers/floor-database.cjs');
test('restaurant switches persist in both directions without touching other settings, quotes or recorded payments',async()=>{
  const db=await database();
  try{
    await db.exec(`alter table v2_restaurants add column settings jsonb default '{"logo_data_url":"image"}';
      insert into v2_quotes(id,restaurant_id,deposit,balance) values('${id(12)}','${rid}',500,2597.60);
      grant usage on schema auth to authenticated; grant select,update on v2_restaurants to authenticated;
      alter table v2_restaurants enable row level security;
      create policy fixture_admin on v2_restaurants to authenticated using (id='${rid}') with check (id='${rid}');`);
    const records=await snapshot(db);
    const script=fs.readFileSync(path.join(__dirname,'..','68_PREFERENCIAS_ANTICIPO.sql'),'utf8');
    await db.exec(script);await db.exec(script);
    const read=async restaurant=>(await db.query('select settings from v2_restaurants where id=$1',[restaurant])).rows[0].settings;
    const pref=(restaurant,key,value)=>db.query('select public.v2_set_quote_deposit_preference($1,$2,$3::jsonb)',[restaurant,key,JSON.stringify(value)]);
    await db.exec('set role authenticated');
    for(const [basis,visible] of [['with_tip',true],['without_tip',false]]){
      await pref(rid,'quote_deposit_suggestion_basis',basis);await pref(rid,'quote_show_deposit_due',visible);
      assert.deepEqual(await read(rid),{logo_data_url:'image',quote_deposit_suggestion_basis:basis,quote_show_deposit_due:visible});
    }
    for(const [key,val] of [['logo_data_url',false],['quote_show_deposit_due','false'],['quote_show_deposit_due',null],['quote_deposit_suggestion_basis',true]]) {
      await assert.rejects(pref(rid,key,val),{code:'22023'});
    }
    await assert.rejects(pref(other,'quote_show_deposit_due',true),{code:'42501'});
    await db.exec("set test.role='operacion'");
    await assert.rejects(pref(rid,'quote_show_deposit_due',true),{code:'42501'});
    await db.exec("reset role;set role anon");
    await assert.rejects(pref(rid,'quote_show_deposit_due',true),{code:'42501'});
    await db.exec('reset role');
    assert.deepEqual(await read(other),{logo_data_url:'image'});
    assert.deepEqual(await snapshot(db),records);
  }finally{await db.close();}
});
