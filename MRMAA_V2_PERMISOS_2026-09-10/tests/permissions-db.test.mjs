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
