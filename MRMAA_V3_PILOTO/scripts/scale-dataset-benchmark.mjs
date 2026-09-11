import { performance } from "node:perf_hooks";
import { PGlite } from "@electric-sql/pglite";

const restaurants = Number(process.env.MRMAA_BENCH_RESTAURANTS || 50_000);
const records = Number(process.env.MRMAA_BENCH_RECORDS || 2_000_000);
const dense = process.env.MRMAA_BENCH_DENSE === '1';
if (!Number.isInteger(restaurants) || restaurants < 1 || !Number.isInteger(records) || records < restaurants)
  throw new Error("Use cantidades enteras; registros debe ser igual o mayor que restaurantes.");

const db = new PGlite();
const timings = {};
async function measured(name, sql) {
  const start = performance.now();
  await db.exec(sql);
  timings[name] = Math.round(performance.now() - start);
}

await measured("schema_ms", `
  create table restaurants(id bigint primary key,name text not null);
  create table reservations(id bigint primary key,restaurant_id bigint not null,event_date date not null,
    client_name text not null,status text not null,total numeric(12,2) not null);
`);
await measured("restaurants_insert_ms", `insert into restaurants select n,'Restaurante '||n from generate_series(1,${restaurants}) n`);
await measured("records_insert_ms", `
  insert into reservations
  select n,${dense ? '1' : `1+((n-1)%${restaurants})`},date '2026-01-01'+((n-1)%730)::integer,
    'Cliente '||n,case when n%3=0 then 'confirmada' else 'pendiente' end,(n%5000)::numeric/10
  from generate_series(1,${records}) n
`);
await measured("indexes_ms", `
  create index reservations_tenant_date on reservations(restaurant_id,event_date desc,id);
  create index reservations_tenant_status_date on reservations(restaurant_id,status,event_date desc);
  analyze reservations;
`);

const samples = [1, Math.ceil(restaurants / 2), restaurants];
const queries = [];
for (const restaurantId of samples) {
  const start = performance.now();
  const result = await db.query(`select id,event_date,client_name,total from reservations
    where restaurant_id=$1 and event_date between date '2026-01-01' and date '2027-12-31'
    order by event_date desc,id limit 50`, [restaurantId]);
  queries.push({ restaurant_id: restaurantId, rows: result.rows.length, duration_ms: Number((performance.now() - start).toFixed(2)) });
}
const isolation = await db.query("select count(distinct restaurant_id)::int tenants,count(*)::int records from reservations");
const output = {
  engine: "PGlite/PostgreSQL aislado; no usa producción",
  scope: dense ? 'Todos los registros en un restaurante; otros restaurantes vacíos' : 'Registros repartidos uniformemente',
  limitations: 'Esquema simplificado. No prueba la aplicación, RLS, concurrencia ni 100,000 millones de registros.',
  requested: { restaurants, records },
  inserted: isolation.rows[0],
  timings,
  tenant_page_queries: queries,
  passed: Number(isolation.rows[0].tenants) === (dense ? 1 : restaurants) && Number(isolation.rows[0].records) === records && queries.every((query) => query.rows === (dense && query.restaurant_id !== 1 ? 0 : Math.min(50, Math.floor(records / (dense ? 1 : restaurants))))),
};
console.log(JSON.stringify(output, null, 2));
await db.close();
if (!output.passed) process.exitCode = 1;
