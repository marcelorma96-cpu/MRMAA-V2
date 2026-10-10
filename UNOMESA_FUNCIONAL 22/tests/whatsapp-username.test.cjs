require('tsx/cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,rpc,save,snapshot,rid,other}=require('./helpers/floor-database.cjs');
const {cleanContent}=require('../lib/restaurant-public.ts');
const content={name:'Restaurante Prueba',channels:['whatsapp'],whatsapp:'50255554444',menus:[],areas:[{id:'area',name:'Jardín',capacity:'80'}],pdfs:[],quotes:true};
const sql=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('SQL 52 accepts the reported username without changing saved content or security',async t=>{
 const db=await database();try{
  await db.exec('create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');
  await db.exec(sql('50_PAGINA_PUBLICA.sql'));await db.exec(sql('51_WHATSAPP_ENLACE_DIRECTO.sql'));
  await save(db,1);let page=await rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,0]);
  const original=await snapshot(db),pages=(await db.query('select * from v2_public_pages')).rows;
  const functions=await db.query("select proname,prosrc,proacl::text from pg_proc where proname like 'v2_%' and proname<>'v2_public_whatsapp_link_valid' order by proname");
  const grants=await db.query("select proacl::text from pg_proc where proname='v2_public_whatsapp_link_valid'");
  await t.test('repeat installation preserves all rows, unrelated functions and helper grants',async()=>{
   await db.exec(sql('52_WHATSAPP_USUARIO.sql'));await db.exec(sql('52_WHATSAPP_USUARIO.sql'));
   assert.deepEqual(await snapshot(db),original);assert.deepEqual((await db.query('select * from v2_public_pages')).rows,pages);
   assert.deepEqual(await db.query("select proname,prosrc,proacl::text from pg_proc where proname like 'v2_%' and proname<>'v2_public_whatsapp_link_valid' order by proname"),functions);
   assert.deepEqual(await db.query("select proacl::text from pg_proc where proname='v2_public_whatsapp_link_valid'"),grants);
  });
  await t.test('HTTP input normalizes before saving and publication preserves the username',async()=>{
   for(const input of ['http://wa.me/entrebrasasgt','https://wa.me/mesa.gt_2','http://wa.me/entrebrasasgt?text=Hola%20%26%20gracias','https://wa.me/message/ABC123','https://wa.me/50255554444','https://api.whatsapp.com/send?phone=%2B50255554444']){
    const c=cleanContent({...content,whatsapp:'',whatsapp_link:input});
    page=await rpc(db,'v2_public_save',[rid,'mi-restaurante',c,true,page.revision]);
    assert.equal((await rpc(db,'v2_public_page',['mi-restaurante'])).content.whatsapp_link,c.whatsapp_link);
    assert.ok(page.content.whatsapp_link.startsWith('https://'));
   }
  });
  await t.test('unsafe links, cross-tenant writes, stale saves and unauthorized roles remain rejected',async()=>{
   for(const link of ['https://evil.test/entrebrasasgt','https://wa.me.evil.test/entrebrasasgt','https://wa.me@evil.test/entrebrasasgt','javascript:alert(1)','https://wa.me/123','https://wa.me/','https://wa.me/entrebrasasgt/extra'])await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',{...content,whatsapp_link:link},true,page.revision]),/PUBLIC_INPUT/);
   await assert.rejects(rpc(db,'v2_public_save',[other,'otra',content,true,0]),/PUBLIC_ACCESS/);
   await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,0]),/PUBLIC_STALE/);
   await db.exec("set test.role='lectura'");await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,page.revision]),/PUBLIC_ACCESS/);
   await db.exec('set role anon');await assert.rejects(rpc(db,'v2_public_save',[rid,'mi-restaurante',content,true,page.revision]),/permission denied/);await db.exec('reset role');
   assert.deepEqual(await snapshot(db),original);
  });
 }finally{await db.close();}
});
