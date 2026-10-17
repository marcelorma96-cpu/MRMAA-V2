const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const tables=['v2_floor_plans','v2_floor_seatings','v2_floor_quote_plans','v2_public_requests'];
const a='33333333-3333-4333-8333-333333333333',b='44444444-4444-4444-8444-444444444444';
const migration=fs.readFileSync('53_SINCRONIZACION_PLANO_Y_SOLICITUDES.sql','utf8');
async function fixture(){const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create schema realtime;
 create table realtime.sent(payload jsonb,event text,topic text,private boolean);
 create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$insert into realtime.sent values(payload,event,topic,private)$$;
 ${tables.map(t=>`create table public.${t}(id int primary key,restaurant_id uuid not null,content text);alter table public.${t} enable row level security;insert into public.${t} values(1,'${a}','saved data'),(2,'${b}','other tenant');`).join('\n')}
`);await db.exec(fs.readFileSync('tests/fixtures/installed-sync-emitter.sql','utf8'));return db;}
async function snapshot(db){return JSON.stringify(await Promise.all(tables.map(t=>db.query(`select * from ${t} order by id`))));}
test('SQL 53 is repeatable and preserves all existing rows, RLS, grants and functions',async()=>{const db=await fixture();try{
 const before=await snapshot(db);
 const catalog=()=>db.query(`select c.relname,c.relrowsecurity,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname`);
 const functions=()=>db.query(`select oid,prosrc,prosecdef,proacl,proconfig from pg_proc where pronamespace='public'::regnamespace order by oid`);
 const grants=await catalog(),body=await functions();
 await db.exec(migration);await db.exec(migration);
 assert.equal(await snapshot(db),before);assert.deepEqual(await catalog(),grants);assert.deepEqual(await functions(),body);
 assert.equal((await db.query('select count(*)::int as n from pg_trigger where not tgisinternal')).rows[0].n,12);
 assert.equal((await db.query('select count(*)::int as n from realtime.sent')).rows[0].n,0);
}finally{await db.close()}});
test('all four tables emit private tenant-only invalidations for inserts, updates and deletes',async()=>{const db=await fixture();try{
 await db.exec(migration);
 for(const table of tables){
  for(const sql of [`insert into ${table} values(3,'${a}','private name'),(4,'${a}','private phone'),(5,'${b}','private email')`,`update ${table} set content='changed' where id>=3`,`delete from ${table} where id>=3`]){
   await db.exec('truncate realtime.sent');await db.exec(sql);
   const rows=(await db.query('select * from realtime.sent order by topic')).rows;
   assert.equal(rows.length,2);
   for(const [i,rid] of [a,b].entries())assert.deepEqual(rows[i],{payload:{v:1,restaurant_id:rid,table},event:'changed',topic:'mrmaa:'+rid,private:true});
  }
 }
}finally{await db.close()}});
test('notifications coalesce within transactions, roll back with writes and never block a save on transport failure',async()=>{const db=await fixture();try{
 await db.exec(migration);await db.exec(`begin;update v2_floor_plans set content='first' where id=1;update v2_floor_plans set content='second' where id=1;commit;`);
 assert.equal((await db.query('select count(*)::int n from realtime.sent')).rows[0].n,1);
 const before=await snapshot(db);await db.exec(`begin;delete from v2_public_requests;rollback;`);assert.equal(await snapshot(db),before);
 assert.equal((await db.query('select count(*)::int n from realtime.sent')).rows[0].n,1);
 await db.exec(`create or replace function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language plpgsql as $$begin raise exception 'transport unavailable';end$$;update v2_public_requests set content='still saved' where id=1;`);
 assert.equal((await db.query('select content from v2_public_requests where id=1')).rows[0].content,'still saved');
}finally{await db.close()}});
function clientFixture(){let tick=0,id=0,callback,subscription;const timers=new Map(),updates=[];const schedule=(fn,delay)=>{timers.set(++id,{fn,at:tick+delay});return id};const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/restaurant-sync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,setTimeout:schedule,clearTimeout:n=>timers.delete(n)});
 const channel={on(_type,_filter,fn){callback=fn;return channel},subscribe(fn){subscription=fn;return channel}};
 const client={channel:()=>channel,removeChannel:async()=>{},realtime:{setAuth:async()=>{}}};
 const connection=module.exports.connectRestaurantSync({client,restaurantId:a,onChange:t=>updates.push(Array.from(t)),onStatus:()=>{},available:()=>true});
 return{updates,connection,send:payload=>callback({payload}),subscribe:()=>subscription('SUBSCRIBED'),advance(ms){tick+=ms;for(const [n,t] of [...timers])if(t.at<=tick){timers.delete(n);t.fn()}}};
}
test('client receives new tables, rejects another tenant and coalesces bursts into one refresh',async()=>{const f=clientFixture();await new Promise(setImmediate);f.subscribe();f.advance(400);f.updates.length=0;
 for(const table of tables){f.send({v:1,restaurant_id:a,table});f.send({v:1,restaurant_id:a,table});}
 f.send({v:1,restaurant_id:b,table:'v2_quotes'});f.send({v:1,restaurant_id:a,table:'auth.users'});f.send({v:2,restaurant_id:a,table:'v2_members'});
 f.advance(399);assert.equal(f.updates.length,0);f.advance(1);assert.deepEqual(f.updates,[tables]);
 f.connection.stop();f.send({v:1,restaurant_id:a,table:'v2_quotes'});f.advance(400);assert.equal(f.updates.length,1);
});
