const fs=require('node:fs');
const {database,rpc,id,rid,other}=require('./floor-database.cjs');
const sql=fs.readFileSync('61_RESERVAS_VARIAS_AREAS.sql','utf8');
const a=id(30),b=id(31),c=id(32);
async function setup(){const db=await database();
 await db.exec('alter table v2_reservation_areas add column name text');
 await db.query('insert into v2_reservation_areas values($1,$2,$3),($4,$2,$5),($6,$2,$7),($8,$9,$10)',[a,rid,'Salón',b,'Terraza',c,'Jardín',id(33),other,'Otro']);
 const def=(await db.query("select pg_get_functiondef('v2_save_quote_once(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure) as source")).rows[0].source;
 const fields=['client_id','client_name','client_phone','client_email','event_date','event_time','area','area_id','guests','subtotal','discount_pct','tip_pct','total','deposit','payment_method','balance','internal_notes'];
 await db.exec(def.replace('client_name=q.client_name,event_date=q.event_date,event_time=q.event_time,guests=q.guests',fields.map(f=>`${f}=q.${f}`).join(',')));
 for(const name of ['45_CRUCES_HORARIO_CONFIRMADOS.sql','46_ASIENTOS_ADICIONALES.sql','54_LECTURA_RAPIDA_ETIQUETAS_MESAS.sql','60_VINCULAR_RESERVAS_COTIZACIONES.sql'])await db.exec(fs.readFileSync(name,'utf8'));
 const layout={areas:[{id:'salon',name:'Salón',eventAreaId:a},{id:'terraza',name:'Terraza',eventAreaId:b},{id:'jardin',name:'Jardín',eventAreaId:c}],tables:[{id:'t1',areaId:'salon',name:'M1',seats:10,shape:'square',x:30,y:50,rotation:0},{id:'t2',areaId:'terraza',name:'M1',seats:10,shape:'square',x:30,y:50,rotation:0}]};
 await rpc(db,'v2_floor_save_layout',[rid,1,layout]);await db.exec(sql);return db;
}
module.exports={setup,a,b,c};
