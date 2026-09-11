import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL engine in memory. All identities/data are fixtures; never connects to Supabase.
const db = new PGlite();
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = uuid(100), B = uuid(200);
const roles = ["administrador", "gerente", "operacion", "lectura", "inactivo", "invitado", "desconocido", "otro_restaurante"];
const user = (role) => uuid(roles.indexOf(role) + 1);
const sqlFile = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const tables = ["v2_clients", "v2_quotes", "v2_quote_items", "v2_reservations", "v2_areas", "v2_employees", "v2_shifts", "v2_schedules", "v2_message_templates", "v2_quote_products", "v2_communication_settings"];
const operated = ["v2_clients", "v2_quotes", "v2_quote_items", "v2_reservations"];
const recyclable = { v2_clients: "clientes", v2_quotes: "cotizaciones", v2_reservations: "reservaciones" };
const entityId = (table, tenant = 100) => uuid(tenant + tables.indexOf(table) + 1);

function insertion(table, tenant = 100, fresh = false) {
  const rid = uuid(tenant), id = fresh ? "gen_random_uuid()" : `'${entityId(table, tenant)}'`;
  const base = `insert into public.${table}`;
  const name = fresh ? "nuevo" : "existente";
  switch (table) {
    case "v2_clients": case "v2_areas": case "v2_employees": case "v2_quote_products":
      return `${base}(id,restaurant_id,name) values (${id},'${rid}','${name}') returning *`;
    case "v2_quotes":
      return `${base}(id,restaurant_id,quote_number,client_name,event_date) values (${id},'${rid}',${fresh ? 2011 : 2010},'${name}','2026-09-10') returning *`;
    case "v2_quote_items":
      return `${base}(id,quote_id,name,quantity,unit_price,line_total) values (${id},'${entityId("v2_quotes", tenant)}','${name}',1,10,10) returning *`;
    case "v2_reservations":
      return `${base}(id,restaurant_id,client_name,event_date) values (${id},'${rid}','${name}','2026-09-10') returning *`;
    case "v2_shifts":
      return `${base}(id,restaurant_id,name,start_time,end_time) values (${id},'${rid}','${name}','09:00','17:00') returning *`;
    case "v2_schedules":
      return `${base}(id,restaurant_id,employee_id,shift_id,work_date) values (${id},'${rid}','${entityId("v2_employees", tenant)}','${entityId("v2_shifts", tenant)}','2026-09-${fresh ? "11" : "10"}') returning *`;
    case "v2_message_templates":
      return `${base}(id,restaurant_id,name,body) values (${id},'${rid}','${name}','Mensaje') returning *`;
    case "v2_communication_settings":
      // Existing singleton: tests exercise its upsert/update path.
      return `${base}(restaurant_id) values ('${rid}') on conflict(restaurant_id) do update set provider='nuevo' returning *`;
    default: throw Error(table);
  }
}

async function as(role, callback) {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user(role)]);
    // Tampered user metadata must never grant extra permissions.
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user(role), user_metadata: { role: "administrador", restaurant_id: B } })]);
    await db.exec("set local role authenticated");
    return await callback();
  } finally { await db.exec("rollback"); }
}

before(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    alter default privileges in schema public grant all on tables to authenticated,anon;
    alter default privileges in schema public grant all on sequences to authenticated,anon;
  `);
  for (const name of ["SUPABASE_V2.sql", "SUPABASE_V2_MODULES.sql", "SUPABASE_V2_ADVANCED.sql", "SUPABASE_SEGURIDAD.sql", "SUPABASE_AJUSTES_FINALES.sql", "SUPABASE_RETENCION_365_DIAS.sql"]) {
    // gen_random_uuid is built into PostgreSQL; PGlite does not need pgcrypto's other functions.
    await db.exec((await sqlFile(name)).replace("create extension if not exists pgcrypto;", ""));
  }
  for (const role of roles) await db.query("insert into auth.users(id,email) values ($1,$2)", [user(role), `${role}@example.test`]);
  for (const [rid, owner] of [[A, user("administrador")], [B, user("otro_restaurante")]]) {
    await db.query("insert into public.v2_restaurants(id,owner_id,name) values ($1,$2,'Prueba')", [rid, owner]);
  }
  for (const role of roles) {
    await db.query("insert into public.v2_members(restaurant_id,user_id,role,status) values ($1,$2,$3,$4)", [
      role === "otro_restaurante" ? B : A, user(role),
      ["inactivo", "invitado", "otro_restaurante"].includes(role) ? "administrador" : role,
      ["inactivo", "invitado"].includes(role) ? role : "activo",
    ]);
  }
  for (const tenant of [100, 200]) for (const table of tables) await db.query(insertion(table, tenant));
  // Establish that the old permissive policies really reproduce the reported issue.
  await as("lectura", async () => {
    const result = await db.query(`update public.v2_clients set name='no autorizado' where id='${entityId("v2_clients")}' returning id`);
    assert.equal(result.rows.length, 1, "la política anterior reproduce el defecto");
  });
  await db.exec(await sqlFile("SUPABASE_PERMISOS_ROLES.sql"));
  // PGlite does not bundle pg_trgm; validate the functions and portable indexes.
  const scalabilitySql = (await sqlFile("SUPABASE_ESCALABILIDAD_50000.sql"))
    .replace(/create extension if not exists pg_trgm with schema extensions;/i, "")
    .replace(/create index if not exists v2_(clients|quotes|reservations)_search_[\s\S]*?where deleted_at is null;/gi, "")
    .replace(/-- STORAGE_BEGIN[\s\S]*?-- STORAGE_END/gi, "");
  await db.exec(scalabilitySql);
  await db.exec(await sqlFile("SUPABASE_SAAS_50000_RESTAURANTES.sql"));
});
after(async () => { await db.close(); });

for (const role of roles) {
  const active = ["administrador", "gerente", "operacion", "lectura", "otro_restaurante"].includes(role);
  const admin = role === "administrador";
  test(`${role}: lectura limitada a su restaurante y membresía activa`, async () => {
    await as(role, async () => {
      for (const table of ["v2_restaurants", ...tables]) {
        const rows = (await db.query(`select * from public.${table}`)).rows;
        assert.equal(rows.length, active ? 1 : 0, table);
        if (rows.length) {
          const tenant = role === "otro_restaurante" ? 200 : 100;
          assert.equal(table === "v2_quote_items" ? rows[0].quote_id : table === "v2_restaurants" ? rows[0].id : rows[0].restaurant_id,
            table === "v2_quote_items" ? entityId("v2_quotes", tenant) : uuid(tenant), table);
        }
      }
      const logs = (await db.query("select * from public.v2_audit_log")).rows;
      assert.equal(logs.length > 0, admin || role === "otro_restaurante");
    });
  });
  for (const table of tables) {
    const canWrite = admin || (operated.includes(table) && ["gerente", "operacion"].includes(role)) || (table === "v2_schedules" && role === "gerente");
    test(`${role}: ${table} INSERT/UPDATE/DELETE`, async () => {
      // Each statement gets an isolated transaction, including denied statements.
      if (canWrite) await as(role, async () => assert.equal((await db.query(insertion(table, 100, true))).rows.length, 1));
      else await assert.rejects(as(role, () => db.query(insertion(table, 100, true))), (error) => error.code === "42501");
      const column = ["v2_quotes", "v2_reservations"].includes(table) ? "client_name" : table === "v2_schedules" ? "notes" : table === "v2_communication_settings" ? "provider" : "name";
      const condition = table === "v2_communication_settings" ? `restaurant_id='${A}'` : `id='${entityId(table)}'`;
      await as(role, async () => {
        const updated = await db.query(`update public.${table} set ${column}='modificado' where ${condition} returning *`);
        assert.equal(updated.rows.length, canWrite ? 1 : 0, `${table} update`);
      });
      if (admin && recyclable[table]) {
        await assert.rejects(as(role, () => db.query(`delete from public.${table} where ${condition}`)), /papelera/);
        await as(role, async () => {
          await db.query("select public.v2_soft_delete($1,$2)", [recyclable[table], entityId(table)]);
          assert.ok((await db.query(`select deleted_at from public.${table} where ${condition}`)).rows[0].deleted_at);
          await db.query("select public.v2_restore_record($1,$2)", [recyclable[table], entityId(table)]);
          assert.equal((await db.query(`select deleted_at from public.${table} where ${condition}`)).rows[0].deleted_at, null);
        });
      } else {
        const canDelete = canWrite && !recyclable[table];
        await as(role, async () => assert.equal((await db.query(`delete from public.${table} where ${condition} returning *`)).rows.length, canDelete ? 1 : 0));
      }
    });
  }
  test(`${role}: configuración y gestión de membresías no se autorizan por metadatos`, async () => {
    await as(role, async () => assert.equal((await db.query(`update public.v2_restaurants set name='Cambio' where id='${A}' returning id`)).rows.length, admin ? 1 : 0));
    // Even admins must use the authenticated server API for membership management.
    await assert.rejects(as(role, () => db.query(`update public.v2_members set role='administrador' where user_id='${user(role)}'`)), (error) => error.code === "42501");
    await assert.rejects(as(role, () => db.query(`insert into public.v2_members(restaurant_id,user_id) values ('${B}','${user(role)}')`)), (error) => error.code === "42501");
    await assert.rejects(as(role, () => db.query("truncate public.v2_clients cascade")), (error) => error.code === "42501");
    if (!admin) for (const fn of ["v2_soft_delete", "v2_restore_record", "v2_purge_record"]) {
      await assert.rejects(as(role, () => db.query(`select public.${fn}('clientes',$1)`, [entityId("v2_clients")])), /administrador/);
    }
  });
}

test("administrador de A no puede escribir filas ni detalles de B", async () => {
  for (const table of tables) {
    await assert.rejects(as("administrador", () => db.query(insertion(table, 200, true))), (error) => error.code === "42501");
  }
});

test("cambiar el rol o desactivar bloquea el siguiente intento sin renovar el JWT", async () => {
  await as("operacion", async () => {
    await db.exec("reset role");
    await db.query("update public.v2_members set role='lectura' where user_id=$1", [user("operacion")]);
    await db.exec("set local role authenticated");
    assert.equal((await db.query(`update public.v2_clients set name='Cambio' where id='${entityId("v2_clients")}' returning id`)).rows.length, 0);
    assert.equal((await db.query("select count(*)::int n from public.v2_clients")).rows[0].n, 1);
    await db.exec("reset role");
    await db.query("update public.v2_members set status='inactivo' where user_id=$1", [user("operacion")]);
    await db.exec("set local role authenticated");
    assert.equal((await db.query("select count(*)::int n from public.v2_clients")).rows[0].n, 0);
  });
});

test("el propietario conserva su rol y la activación de invitación no eleva permisos", async () => {
  await assert.rejects(db.query("update public.v2_members set role='lectura' where user_id=$1", [user("administrador")]), /Transfiera primero/);
  await db.query("update public.v2_members set role='lectura' where user_id=$1", [user("invitado")]);
  try {
    await as("invitado", async () => {
      await db.query("select public.v2_activate_my_membership()");
      const membership = (await db.query("select role,status from public.v2_members where user_id=auth.uid()")).rows[0];
      assert.deepEqual(membership, { role: "lectura", status: "activo" });
      assert.equal((await db.query(`update public.v2_clients set name='Cambio' where id='${entityId("v2_clients")}' returning id`)).rows.length, 0);
    });
  } finally { await db.query("update public.v2_members set role='administrador' where user_id=$1", [user("invitado")]); }
});

test("ambos scripts son repetibles y conservan roles, estados y registros", async () => {
  const before = await db.query("select restaurant_id,user_id,role,status from public.v2_members order by user_id");
  for (let pass = 0; pass < 2; pass++) {
    await db.exec(await sqlFile("SUPABASE_PROTECCION_PRODUCCION.sql"));
    await db.exec(await sqlFile("SUPABASE_PERMISOS_ROLES.sql"));
  }
  assert.deepEqual((await db.query("select restaurant_id,user_id,role,status from public.v2_members order by user_id")).rows, before.rows);
  assert.equal((await db.query("select count(*)::int n from public.v2_clients")).rows[0].n, 2);
  await assert.rejects(as("lectura", () => db.query(insertion("v2_clients", 100, true))), (error) => error.code === "42501");
});

test("visitantes sin sesión no tienen permisos sobre las tablas del restaurante", async () => {
  for (const table of ["v2_restaurants", "v2_members", ...tables, "v2_audit_log"]) {
    await db.exec("begin; set local role anon");
    try { await assert.rejects(db.query(`select * from public.${table}`), (error) => error.code === "42501"); }
    finally { await db.exec("rollback"); }
  }
});

test("resúmenes y reportes escalables respetan restaurante y rol", async () => {
  await as("administrador", async () => {
    const summary = (await db.query("select * from public.v2_reservation_summary($1,'all',current_date,null,null,'')", [A])).rows[0];
    assert.equal(Number(summary.reservations), 1);
    const report = await db.query("select * from public.v2_report_rows($1,'reserved','2026-01-01','2026-12-31','',0,50)", [A]);
    assert.equal(report.rows.length, 1);
    assert.equal(Number(report.rows[0].total_count), 1);
  });
  await assert.rejects(as("lectura", () => db.query("select * from public.v2_report_rows($1,'reserved','2026-01-01','2026-12-31','',0,50)", [A])), /Acceso denegado/);
});

test("importación por lotes crea, actualiza y omite filas idénticas", async () => {
  await as("operacion", async () => {
    const payload = [{ client_name: "Importado", phone: "5555", event_date: "2026-10-01", event_time: "18:00", area: "Terraza", guests: 10, menu: "Menú", deposit: 100, payment_method: "efectivo", status: "pendiente", notes: "" }];
    const first = (await db.query("select * from public.v2_import_reservations($1,$2::jsonb)", [A, JSON.stringify(payload)])).rows[0];
    assert.deepEqual(first, { created: 1, updated: 0, unchanged: 0 });
    const second = (await db.query("select * from public.v2_import_reservations($1,$2::jsonb)", [A, JSON.stringify(payload)])).rows[0];
    assert.deepEqual(second, { created: 0, updated: 0, unchanged: 1 });
    payload[0].guests = 12;
    const third = (await db.query("select * from public.v2_import_reservations($1,$2::jsonb)", [A, JSON.stringify(payload)])).rows[0];
    assert.deepEqual(third, { created: 0, updated: 1, unchanged: 0 });
  });
});

test("resolución de clientes reutiliza identidades normalizadas y respeta permisos", async () => {
  await as("operacion", async () => {
    const first = (await db.query("select public.v2_find_or_create_client($1,$2,$3,$4) id", [A, "Cliente concurrente", "+502 5555-0101", "CLIENTE@EJEMPLO.COM"])).rows[0].id;
    const second = (await db.query("select public.v2_find_or_create_client($1,$2,$3,$4) id", [A, "Otro nombre", "50255550101", "cliente@ejemplo.com"])).rows[0].id;
    assert.equal(second, first);
    const duplicate = (await db.query("select * from public.v2_find_duplicate_client($1,$2,$3,$4,null)", [A, "Cualquiera", "502 5555 0101", ""])).rows[0];
    assert.equal(duplicate.id, first);
    assert.equal(duplicate.match_reason, "teléfono");
  });
  await assert.rejects(as("lectura", () => db.query("select public.v2_find_or_create_client($1,$2,$3,$4)", [A, "Sin permiso", "", ""])), /Acceso denegado/);
});

test("infraestructura SaaS registra ubicación, uso, rate limit e idempotencia", async () => {
  assert.equal((await db.query("select cluster_key from public.v2_tenant_locations where restaurant_id=$1", [A])).rows[0].cluster_key, "primary");
  await db.query("select public.v2_rebuild_tenant_usage($1)", [A]);
  const usage = (await db.query("select * from public.v2_tenant_usage where restaurant_id=$1", [A])).rows[0];
  assert.ok(Number(usage.clients) >= 1);
  assert.equal((await db.query("select public.v2_take_rate_limit('test','subject',2,60) allowed")).rows[0].allowed, true);
  assert.equal((await db.query("select public.v2_take_rate_limit('test','subject',2,60) allowed")).rows[0].allowed, true);
  assert.equal((await db.query("select public.v2_take_rate_limit('test','subject',2,60) allowed")).rows[0].allowed, false);
  const first = (await db.query("select * from public.v2_claim_idempotency('payment','key-1',$1,'hash')", [A])).rows[0];
  const second = (await db.query("select * from public.v2_claim_idempotency('payment','key-1',$1,'hash')", [A])).rows[0];
  assert.equal(first.claimed, true);
  assert.equal(second.claimed, false);
});

test("la migración SaaS es repetible y conserva los datos internos", async () => {
  const before = (await db.query("select count(*)::int n from public.v2_tenant_locations")).rows[0].n;
  await db.exec(await sqlFile("SUPABASE_SAAS_50000_RESTAURANTES.sql"));
  const after = (await db.query("select count(*)::int n from public.v2_tenant_locations")).rows[0].n;
  assert.equal(after, before);
});

test("cola durable reclama cada trabajo una sola vez y registra reintentos", async () => {
  const id = (await db.query("select public.v2_enqueue_job($1,'export','{}'::jsonb,100::smallint) id", [A])).rows[0].id;
  const claimed = await db.query("select * from public.v2_claim_jobs('worker-1',10)");
  assert.ok(claimed.rows.some((row) => String(row.id) === String(id)));
  assert.equal((await db.query("select * from public.v2_claim_jobs('worker-2',10)")).rows.length, 0);
  await db.query("select public.v2_finish_job($1,null)", [id]);
  assert.equal((await db.query("select status from public.v2_jobs where id=$1", [id])).rows[0].status, "completed");
});

test("tablas internas SaaS no son visibles para usuarios del restaurante", async () => {
  for (const table of ["v2_tenant_locations","v2_tenant_usage","v2_jobs","v2_rate_limits","v2_platform_metrics_hourly"])
    await assert.rejects(as("administrador", () => db.query(`select * from public.${table}`)), (error) => error.code === "42501");
});

test("paginación conserva 50 filas aun con 50,000 clientes", async () => {
  await as("administrador", async () => {
    await db.query("insert into public.v2_clients(restaurant_id,name) select $1,'Cliente '||n from generate_series(1,50000) n", [A]);
    const page = await db.query("select id from public.v2_clients where restaurant_id=$1 and deleted_at is null order by name offset 49950 limit 50", [A]);
    assert.equal(page.rows.length, 50);
  });
});

test("V3 conserva negocio, limita limpieza y protege funciones internas", async () => {
  const before = (await db.query('select count(*)::int n from public.v2_clients')).rows[0].n;
  await db.exec(await sqlFile('SUPABASE_VOLUMEN_V3.sql'));
  await db.exec(await sqlFile('SUPABASE_VOLUMEN_V3.sql'));
  // PGlite no reproduce construcción concurrente; ejecuta las definiciones.
  await db.exec((await sqlFile('SUPABASE_INDICES_V3.sql')).replace(/create index concurrently/gi,'create index'));
  await db.exec(`insert into public.v2_rate_limits(bucket,subject_hash,window_start,hits,expires_at)
    select 'expired',n::text,now(),1,now()-interval '1 day' from generate_series(1,1200) n;
    insert into public.v2_rate_limits(bucket,subject_hash,window_start,hits,expires_at)
    values('keep','keep',now(),1,now()+interval '1 day');`);
  const cleanup = (await db.query('select public.v2_platform_maintenance() result')).rows[0].result;
  assert.equal(cleanup.rate_limits,1000);
  assert.equal(cleanup.more_possible,true);
  assert.equal((await db.query("select count(*)::int n from public.v2_rate_limits where bucket='expired'")).rows[0].n,200);
  assert.equal((await db.query("select count(*)::int n from public.v2_rate_limits where bucket='keep'")).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.v2_clients')).rows[0].n,before);
  await db.query("update public.v2_tenant_usage set measured_at=now()");
  assert.equal((await db.query('select public.v2_refresh_usage_batch(500) n')).rows[0].n,0);
  await assert.rejects(as('administrador',()=>db.query('select public.v2_platform_maintenance()')),e=>e.code==='42501');
  await assert.rejects(as('lectura',()=>db.query('select public.v2_refresh_usage_batch(1)')),e=>e.code==='42501');
});
