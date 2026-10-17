const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,rpc,save,snapshot,rid,other,id}=require('./helpers/floor-database.cjs');
const sql=fs.readFileSync(path.join(__dirname,'../51_WHATSAPP_ENLACE_DIRECTO.sql'),'utf8');
const content={name:'Restaurante Prueba',description:'Bienvenidos',channels:['whatsapp'],whatsapp:'50255554444',menus:[],areas:[{id:'a',name:'Jardín',capacity:'80'}],pdfs:[],quotes:true};
test('SQL 51 preserves saved data and authorization while allowing direct business links',async t=>{
 const db=await database();try{
  await db.exec('create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');
  await db.exec(fs.readFileSync(path.join(__dirname,'../50_PAGINA_PUBLICA.sql'),'utf8'));
  await save(db,1);let page=await rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,0]);
  const original=await snapshot(db),pages=(await db.query('select * from v2_public_pages')).rows;
  const functions=await db.query("select proname,prosrc,proacl::text from pg_proc where proname like 'v2_%' and proname<>'v2_public_save' order by proname");
  const permissions=await db.query("select proacl::text from pg_proc where proname='v2_public_save'");
  await t.test('repeat installation does not mutate data, grants or unrelated functions',async()=>{
   await db.exec(sql);await db.exec(sql);assert.deepEqual(await snapshot(db),original);assert.deepEqual((await db.query('select * from v2_public_pages')).rows,pages);
   assert.deepEqual(await db.query("select proname,prosrc,proacl::text from pg_proc where proname like 'v2_%' and proname not in ('v2_public_save','v2_public_whatsapp_link_valid') order by proname"),functions);
   assert.deepEqual(await db.query("select proacl::text from pg_proc where proname='v2_public_save'"),permissions);
  });
  await t.test('official links save without a phone number and preserve supplied messages',async()=>{
   for(const link of ['https://wa.me/message/ABC123xyz?text=Hola%20mundo','https://wa.me/50255554444','https://api.whatsapp.com/message/ABC123xyz','https://api.whatsapp.com/send?phone=%2B50255554444&text=Hola']){
    page=await rpc(db,'v2_public_save',[rid,'mi-restaurante',{...content,whatsapp:'',whatsapp_link:link},true,page.revision]);
    assert.equal((await rpc(db,'v2_public_page',['mi-restaurante'])).content.whatsapp_link,link);
   }
   page=await rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,page.revision]);assert.equal(page.content.whatsapp,content.whatsapp);
  });
  await t.test('invalid direct links cannot fall back to an unrelated phone, other channels still validate',async()=>{
   for(const link of ['http://wa.me/message/ABC123','https://wa.me.evil.test/message/ABC123','https://wa.me@evil.test/message/ABC123','https://wa.me/message/ABC123#anchor','https://api.whatsapp.com/send?phone=123','javascript:alert(1)','https://wa.me/message/abc'])await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',{...content,whatsapp_link:link},true,page.revision]),/PUBLIC_INPUT/);
   for(const ch of ['phone','email','sms'])await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',{...content,channels:[ch]},true,page.revision]),/PUBLIC_INPUT/);
  });
  await t.test('tenant, role, session and concurrent-change protection remain in force',async()=>{
   await assert.rejects(rpc(db,'v2_public_save',[other,'otra',content,true,0]),/PUBLIC_ACCESS/);
   await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,0]),/PUBLIC_STALE/);
   await db.exec("set test.role='operacion'");await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,page.revision]),/PUBLIC_ACCESS/);
   await db.exec("set test.role='administrador';set role anon");await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,page.revision]),/permission denied/);
   await db.exec('reset role');await db.exec('create or replace function v2_session_alive() returns boolean language sql as $$select false$$');await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,page.revision]),/PUBLIC_ACCESS/);
   assert.deepEqual(await snapshot(db),original);
  });
 }finally{await db.close();}
});
