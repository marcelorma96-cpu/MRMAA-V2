-- MRMAA · MIGRACIÓN DEL PILOTO · 14 septiembre 2026
-- Basada en el esquema exportado por el usuario; NO es instalación completa.
-- Ejecutar TODO junto, rol postgres, únicamente en el Supabase del piloto.
-- La transacción agrega estructura y sustituye funciones; no borra registros.
-- Único cambio a filas existentes: excepción de cobro del restaurante verificado.
-- No cambia settings/logos, planes guardados, fechas, roles ni registros comerciales.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, extensions, pg_catalog;
SELECT pg_advisory_xact_lock(hashtextextended('MRMAA_PILOT_UPGRADE_20260914',0));
DO $preflight$
DECLARE n integer; rid uuid;
BEGIN
 IF to_regclass('public.v2_restaurants') IS NULL OR to_regclass('auth.users') IS NULL THEN
  RAISE EXCEPTION 'Este archivo requiere el piloto existente. No es una instalación nueva.';
 END IF;
 IF obj_description('public.v2_restaurants'::regclass,'pg_class') = 'MRMAA_FRESH_TEST_PROJECT_2026_09_12' THEN
  RAISE EXCEPTION 'Este es el proyecto de pruebas. Abra el Supabase del piloto.';
 END IF;
 SELECT count(*), (array_agg(r.id))[1] INTO n,rid
 FROM public.v2_restaurants r JOIN auth.users u ON u.id=r.owner_id
 JOIN public.v2_members m ON m.restaurant_id=r.id AND m.user_id=u.id
 WHERE lower(u.email)='marcelorma96@gmail.com' AND u.email_confirmed_at IS NOT NULL
 AND m.status='activo' AND m.role IN ('administrador','admin');
 IF n<>1 THEN RAISE EXCEPTION 'Se esperaba exactamente un restaurante del administrador verificado marcelorma96@gmail.com; encontrados: %. No se modificó nada.',n; END IF;
 IF EXISTS(SELECT 1 FROM public.v2_restaurants WHERE id=rid AND (access_status IN ('suspended','deleted') OR deletion_scheduled_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'El piloto tiene suspensión o eliminación programada; requiere revisión antes de migrar.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.v2_restaurants WHERE stripe_subscription_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Existe una suscripción Stripe; revisar antes de incorporar Lemon Squeezy.';
 END IF;
END $preflight$;


DO $shape$ BEGIN IF EXISTS (SELECT 1 FROM jsonb_to_recordset('[{"t": "v2_areas", "n": "id", "y": "uuid", "r": true}, {"t": "v2_areas", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_areas", "n": "name", "y": "text", "r": true}, {"t": "v2_areas", "n": "color", "y": "text", "r": true}, {"t": "v2_areas", "n": "active", "y": "boolean", "r": true}, {"t": "v2_areas", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_audit_log", "n": "id", "y": "bigint", "r": true}, {"t": "v2_audit_log", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_audit_log", "n": "table_name", "y": "text", "r": true}, {"t": "v2_audit_log", "n": "record_id", "y": "uuid", "r": true}, {"t": "v2_audit_log", "n": "action", "y": "text", "r": true}, {"t": "v2_audit_log", "n": "old_data", "y": "jsonb", "r": false}, {"t": "v2_audit_log", "n": "new_data", "y": "jsonb", "r": false}, {"t": "v2_audit_log", "n": "changed_by", "y": "uuid", "r": false}, {"t": "v2_audit_log", "n": "changed_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_audit_log", "n": "actor_name", "y": "text", "r": false}, {"t": "v2_audit_log", "n": "actor_role", "y": "text", "r": false}, {"t": "v2_clients", "n": "id", "y": "uuid", "r": true}, {"t": "v2_clients", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_clients", "n": "name", "y": "text", "r": true}, {"t": "v2_clients", "n": "phone", "y": "text", "r": false}, {"t": "v2_clients", "n": "email", "y": "text", "r": false}, {"t": "v2_clients", "n": "notes", "y": "text", "r": false}, {"t": "v2_clients", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_clients", "n": "deleted_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_clients", "n": "deleted_by", "y": "uuid", "r": false}, {"t": "v2_communication_settings", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_communication_settings", "n": "channel", "y": "text", "r": true}, {"t": "v2_communication_settings", "n": "provider", "y": "text", "r": true}, {"t": "v2_communication_settings", "n": "connection_status", "y": "text", "r": true}, {"t": "v2_communication_settings", "n": "reservation_confirmed", "y": "boolean", "r": true}, {"t": "v2_communication_settings", "n": "reservation_tomorrow", "y": "boolean", "r": true}, {"t": "v2_communication_settings", "n": "pending_quote", "y": "boolean", "r": true}, {"t": "v2_communication_settings", "n": "updated_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_employees", "n": "id", "y": "uuid", "r": true}, {"t": "v2_employees", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_employees", "n": "name", "y": "text", "r": true}, {"t": "v2_employees", "n": "employee_code", "y": "text", "r": true}, {"t": "v2_employees", "n": "phone", "y": "text", "r": true}, {"t": "v2_employees", "n": "area_id", "y": "uuid", "r": false}, {"t": "v2_employees", "n": "active", "y": "boolean", "r": true}, {"t": "v2_employees", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_idempotency_keys", "n": "scope", "y": "text", "r": true}, {"t": "v2_idempotency_keys", "n": "idempotency_key", "y": "text", "r": true}, {"t": "v2_idempotency_keys", "n": "restaurant_id", "y": "uuid", "r": false}, {"t": "v2_idempotency_keys", "n": "request_hash", "y": "text", "r": false}, {"t": "v2_idempotency_keys", "n": "status", "y": "text", "r": true}, {"t": "v2_idempotency_keys", "n": "response_code", "y": "integer", "r": false}, {"t": "v2_idempotency_keys", "n": "response_body", "y": "jsonb", "r": false}, {"t": "v2_idempotency_keys", "n": "locked_until", "y": "timestamp with time zone", "r": true}, {"t": "v2_idempotency_keys", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_idempotency_keys", "n": "completed_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_jobs", "n": "id", "y": "bigint", "r": true}, {"t": "v2_jobs", "n": "restaurant_id", "y": "uuid", "r": false}, {"t": "v2_jobs", "n": "job_type", "y": "text", "r": true}, {"t": "v2_jobs", "n": "payload", "y": "jsonb", "r": true}, {"t": "v2_jobs", "n": "status", "y": "text", "r": true}, {"t": "v2_jobs", "n": "priority", "y": "smallint", "r": true}, {"t": "v2_jobs", "n": "attempts", "y": "integer", "r": true}, {"t": "v2_jobs", "n": "max_attempts", "y": "integer", "r": true}, {"t": "v2_jobs", "n": "available_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_jobs", "n": "locked_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_jobs", "n": "locked_by", "y": "text", "r": false}, {"t": "v2_jobs", "n": "last_error", "y": "text", "r": false}, {"t": "v2_jobs", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_jobs", "n": "completed_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_legal_acceptances", "n": "id", "y": "bigint", "r": true}, {"t": "v2_legal_acceptances", "n": "user_id", "y": "uuid", "r": true}, {"t": "v2_legal_acceptances", "n": "restaurant_id", "y": "uuid", "r": false}, {"t": "v2_legal_acceptances", "n": "legal_version", "y": "text", "r": true}, {"t": "v2_legal_acceptances", "n": "accepted_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_legal_acceptances", "n": "user_agent", "y": "text", "r": false}, {"t": "v2_members", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_members", "n": "user_id", "y": "uuid", "r": true}, {"t": "v2_members", "n": "role", "y": "text", "r": true}, {"t": "v2_members", "n": "name", "y": "text", "r": true}, {"t": "v2_members", "n": "email", "y": "text", "r": true}, {"t": "v2_members", "n": "status", "y": "text", "r": true}, {"t": "v2_members", "n": "invited_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_members", "n": "last_invited_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_members", "n": "invite_token_hash", "y": "text", "r": false}, {"t": "v2_message_templates", "n": "id", "y": "uuid", "r": true}, {"t": "v2_message_templates", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_message_templates", "n": "name", "y": "text", "r": true}, {"t": "v2_message_templates", "n": "category", "y": "text", "r": true}, {"t": "v2_message_templates", "n": "body", "y": "text", "r": true}, {"t": "v2_message_templates", "n": "active", "y": "boolean", "r": true}, {"t": "v2_message_templates", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_plan_limits", "n": "plan_code", "y": "text", "r": true}, {"t": "v2_plan_limits", "n": "max_members", "y": "bigint", "r": false}, {"t": "v2_plan_limits", "n": "max_clients", "y": "bigint", "r": false}, {"t": "v2_plan_limits", "n": "max_quotes", "y": "bigint", "r": false}, {"t": "v2_plan_limits", "n": "max_reservations", "y": "bigint", "r": false}, {"t": "v2_plan_limits", "n": "max_storage_bytes", "y": "bigint", "r": false}, {"t": "v2_plan_limits", "n": "updated_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_platform_admins", "n": "user_id", "y": "uuid", "r": true}, {"t": "v2_platform_admins", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_platform_metrics_hourly", "n": "hour", "y": "timestamp with time zone", "r": true}, {"t": "v2_platform_metrics_hourly", "n": "metric", "y": "text", "r": true}, {"t": "v2_platform_metrics_hourly", "n": "dimension", "y": "text", "r": true}, {"t": "v2_platform_metrics_hourly", "n": "count", "y": "bigint", "r": true}, {"t": "v2_platform_metrics_hourly", "n": "total_ms", "y": "bigint", "r": true}, {"t": "v2_platform_metrics_hourly", "n": "errors", "y": "bigint", "r": true}, {"t": "v2_quote_items", "n": "id", "y": "uuid", "r": true}, {"t": "v2_quote_items", "n": "quote_id", "y": "uuid", "r": true}, {"t": "v2_quote_items", "n": "position", "y": "integer", "r": true}, {"t": "v2_quote_items", "n": "name", "y": "text", "r": true}, {"t": "v2_quote_items", "n": "description", "y": "text", "r": false}, {"t": "v2_quote_items", "n": "quantity", "y": "numeric(12,2)", "r": true}, {"t": "v2_quote_items", "n": "unit_price", "y": "numeric(12,2)", "r": true}, {"t": "v2_quote_items", "n": "line_total", "y": "numeric(12,2)", "r": true}, {"t": "v2_quote_products", "n": "id", "y": "uuid", "r": true}, {"t": "v2_quote_products", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_quote_products", "n": "name", "y": "text", "r": true}, {"t": "v2_quote_products", "n": "description", "y": "text", "r": true}, {"t": "v2_quote_products", "n": "price", "y": "numeric(12,2)", "r": true}, {"t": "v2_quote_products", "n": "active", "y": "boolean", "r": true}, {"t": "v2_quote_products", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_quotes", "n": "id", "y": "uuid", "r": true}, {"t": "v2_quotes", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_quotes", "n": "client_id", "y": "uuid", "r": false}, {"t": "v2_quotes", "n": "quote_number", "y": "integer", "r": true}, {"t": "v2_quotes", "n": "client_name", "y": "text", "r": true}, {"t": "v2_quotes", "n": "client_phone", "y": "text", "r": true}, {"t": "v2_quotes", "n": "client_email", "y": "text", "r": true}, {"t": "v2_quotes", "n": "event_date", "y": "date", "r": true}, {"t": "v2_quotes", "n": "event_time", "y": "time without time zone", "r": false}, {"t": "v2_quotes", "n": "area", "y": "text", "r": true}, {"t": "v2_quotes", "n": "guests", "y": "integer", "r": true}, {"t": "v2_quotes", "n": "discount_pct", "y": "numeric(5,2)", "r": true}, {"t": "v2_quotes", "n": "tip_pct", "y": "numeric(5,2)", "r": true}, {"t": "v2_quotes", "n": "subtotal", "y": "numeric(12,2)", "r": true}, {"t": "v2_quotes", "n": "total", "y": "numeric(12,2)", "r": true}, {"t": "v2_quotes", "n": "deposit", "y": "numeric(12,2)", "r": true}, {"t": "v2_quotes", "n": "balance", "y": "numeric(12,2)", "r": true}, {"t": "v2_quotes", "n": "customer_note", "y": "text", "r": true}, {"t": "v2_quotes", "n": "internal_notes", "y": "text", "r": true}, {"t": "v2_quotes", "n": "status", "y": "text", "r": true}, {"t": "v2_quotes", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_quotes", "n": "updated_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_quotes", "n": "deleted_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_quotes", "n": "deleted_by", "y": "uuid", "r": false}, {"t": "v2_quotes", "n": "custom_fields", "y": "jsonb", "r": true}, {"t": "v2_quotes", "n": "adjustments", "y": "jsonb", "r": true}, {"t": "v2_quotes", "n": "payment_method", "y": "text", "r": true}, {"t": "v2_quotes", "n": "area_id", "y": "uuid", "r": false}, {"t": "v2_rate_limits", "n": "bucket", "y": "text", "r": true}, {"t": "v2_rate_limits", "n": "subject_hash", "y": "text", "r": true}, {"t": "v2_rate_limits", "n": "window_start", "y": "timestamp with time zone", "r": true}, {"t": "v2_rate_limits", "n": "hits", "y": "integer", "r": true}, {"t": "v2_rate_limits", "n": "expires_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_reservation_areas", "n": "id", "y": "uuid", "r": true}, {"t": "v2_reservation_areas", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_reservation_areas", "n": "name", "y": "text", "r": true}, {"t": "v2_reservation_areas", "n": "active", "y": "boolean", "r": true}, {"t": "v2_reservations", "n": "id", "y": "uuid", "r": true}, {"t": "v2_reservations", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_reservations", "n": "quote_id", "y": "uuid", "r": false}, {"t": "v2_reservations", "n": "client_id", "y": "uuid", "r": false}, {"t": "v2_reservations", "n": "client_name", "y": "text", "r": true}, {"t": "v2_reservations", "n": "phone", "y": "text", "r": true}, {"t": "v2_reservations", "n": "event_date", "y": "date", "r": true}, {"t": "v2_reservations", "n": "event_time", "y": "time without time zone", "r": false}, {"t": "v2_reservations", "n": "area", "y": "text", "r": true}, {"t": "v2_reservations", "n": "guests", "y": "integer", "r": false}, {"t": "v2_reservations", "n": "menu", "y": "text", "r": true}, {"t": "v2_reservations", "n": "subtotal", "y": "numeric(12,2)", "r": true}, {"t": "v2_reservations", "n": "discount_pct", "y": "numeric(5,2)", "r": true}, {"t": "v2_reservations", "n": "tip_pct", "y": "numeric(5,2)", "r": true}, {"t": "v2_reservations", "n": "total", "y": "numeric(12,2)", "r": true}, {"t": "v2_reservations", "n": "deposit", "y": "numeric(12,2)", "r": false}, {"t": "v2_reservations", "n": "balance", "y": "numeric(12,2)", "r": true}, {"t": "v2_reservations", "n": "notes", "y": "text", "r": true}, {"t": "v2_reservations", "n": "status", "y": "text", "r": true}, {"t": "v2_reservations", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_reservations", "n": "updated_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_reservations", "n": "deleted_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_reservations", "n": "deleted_by", "y": "uuid", "r": false}, {"t": "v2_reservations", "n": "payment_method", "y": "text", "r": true}, {"t": "v2_reservations", "n": "area_id", "y": "uuid", "r": false}, {"t": "v2_restaurants", "n": "id", "y": "uuid", "r": true}, {"t": "v2_restaurants", "n": "owner_id", "y": "uuid", "r": true}, {"t": "v2_restaurants", "n": "name", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_restaurants", "n": "owner_name", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "phone", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "country", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "language", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "currency", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "plan_code", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "trial_started_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_restaurants", "n": "trial_ends_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_restaurants", "n": "subscription_status", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "quote_number_start", "y": "integer", "r": true}, {"t": "v2_restaurants", "n": "settings", "y": "jsonb", "r": true}, {"t": "v2_restaurants", "n": "access_status", "y": "text", "r": true}, {"t": "v2_restaurants", "n": "billing_enforcement_enabled", "y": "boolean", "r": true}, {"t": "v2_restaurants", "n": "grace_ends_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_restaurants", "n": "restricted_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_restaurants", "n": "cancelled_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_restaurants", "n": "export_until", "y": "timestamp with time zone", "r": false}, {"t": "v2_restaurants", "n": "deletion_scheduled_at", "y": "timestamp with time zone", "r": false}, {"t": "v2_restaurants", "n": "stripe_customer_id", "y": "text", "r": false}, {"t": "v2_restaurants", "n": "stripe_subscription_id", "y": "text", "r": false}, {"t": "v2_restaurants", "n": "allow_team_excel_exports", "y": "boolean", "r": true}, {"t": "v2_schedules", "n": "id", "y": "uuid", "r": true}, {"t": "v2_schedules", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_schedules", "n": "employee_id", "y": "uuid", "r": true}, {"t": "v2_schedules", "n": "area_id", "y": "uuid", "r": false}, {"t": "v2_schedules", "n": "shift_id", "y": "uuid", "r": false}, {"t": "v2_schedules", "n": "work_date", "y": "date", "r": true}, {"t": "v2_schedules", "n": "notes", "y": "text", "r": true}, {"t": "v2_schedules", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_schedules", "n": "entry_type", "y": "text", "r": true}, {"t": "v2_schedules", "n": "break_start", "y": "time without time zone", "r": false}, {"t": "v2_schedules", "n": "break_end", "y": "time without time zone", "r": false}, {"t": "v2_shifts", "n": "id", "y": "uuid", "r": true}, {"t": "v2_shifts", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_shifts", "n": "name", "y": "text", "r": true}, {"t": "v2_shifts", "n": "start_time", "y": "time without time zone", "r": true}, {"t": "v2_shifts", "n": "end_time", "y": "time without time zone", "r": true}, {"t": "v2_shifts", "n": "break_minutes", "y": "integer", "r": true}, {"t": "v2_shifts", "n": "active", "y": "boolean", "r": true}, {"t": "v2_shifts", "n": "created_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_tenant_locations", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_tenant_locations", "n": "cluster_key", "y": "text", "r": true}, {"t": "v2_tenant_locations", "n": "region", "y": "text", "r": true}, {"t": "v2_tenant_locations", "n": "migration_status", "y": "text", "r": true}, {"t": "v2_tenant_locations", "n": "updated_at", "y": "timestamp with time zone", "r": true}, {"t": "v2_tenant_usage", "n": "restaurant_id", "y": "uuid", "r": true}, {"t": "v2_tenant_usage", "n": "members", "y": "bigint", "r": true}, {"t": "v2_tenant_usage", "n": "clients", "y": "bigint", "r": true}, {"t": "v2_tenant_usage", "n": "quotes", "y": "bigint", "r": true}, {"t": "v2_tenant_usage", "n": "reservations", "y": "bigint", "r": true}, {"t": "v2_tenant_usage", "n": "storage_bytes", "y": "bigint", "r": true}, {"t": "v2_tenant_usage", "n": "measured_at", "y": "timestamp with time zone", "r": true}]'::jsonb) AS e(t text,n text,y text,r boolean)
LEFT JOIN pg_class c ON c.relname=e.t AND c.relnamespace='public'::regnamespace
LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname=e.n AND NOT a.attisdropped
WHERE a.attnum IS NULL OR format_type(a.atttypid,a.atttypmod)<>e.y OR a.attnotnull<>e.r)
THEN RAISE EXCEPTION 'El esquema del piloto cambió desde el diagnóstico. Envíe un nuevo CSV; no se modificó nada.'; END IF; END $shape$;

CREATE TABLE IF NOT EXISTS public."v2_billing_events" (
 "event_id" text NOT NULL,
 "restaurant_id" uuid NOT NULL,
 "event_created" bigint NOT NULL,
 "received_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public."v2_billing_events" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."v2_billing_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."v2_billing_events" TO service_role;

CREATE TABLE IF NOT EXISTS public."v2_billing_state" (
 "restaurant_id" uuid NOT NULL,
 "lease_token" uuid,
 "lease_until" timestamp with time zone,
 "checkout_id" text,
 "checkout_key" uuid DEFAULT gen_random_uuid() NOT NULL,
 "checkout_plan" text,
 "checkout_cycle" text
);

ALTER TABLE public."v2_billing_state" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."v2_billing_state" FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."v2_billing_state" TO service_role;

CREATE TABLE IF NOT EXISTS public."v2_lemon_checkouts" (
 "id" uuid NOT NULL,
 "restaurant_id" uuid NOT NULL,
 "owner_id" uuid NOT NULL,
 "owner_email" text NOT NULL,
 "store_id" text NOT NULL,
 "variant_id" text NOT NULL,
 "plan_code" text NOT NULL,
 "billing_cycle" text NOT NULL,
 "expires_at" timestamp with time zone NOT NULL,
 "checkout_id" text,
 "checkout_url" text,
 "subscription_id" text,
 "customer_id" text,
 "order_id" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public."v2_lemon_checkouts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."v2_lemon_checkouts" FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."v2_lemon_checkouts" TO service_role;

CREATE TABLE IF NOT EXISTS public."v2_registration_intents" (
 "token" uuid DEFAULT gen_random_uuid() NOT NULL,
 "email" text NOT NULL,
 "full_name" text NOT NULL,
 "restaurant_name" text NOT NULL,
 "phone" text DEFAULT ''::text NOT NULL,
 "country" text DEFAULT 'Guatemala'::text NOT NULL,
 "language" text NOT NULL,
 "currency" text NOT NULL,
 "plan_code" text NOT NULL,
 "billing_cycle" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "consumed_at" timestamp with time zone,
 "user_id" uuid
);

ALTER TABLE public."v2_registration_intents" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public."v2_registration_intents" FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."v2_registration_intents" TO service_role;

ALTER TABLE public."v2_restaurants" ADD COLUMN IF NOT EXISTS "billing_cycle" text DEFAULT 'month'::text NOT NULL;

ALTER TABLE public."v2_restaurants" ADD COLUMN IF NOT EXISTS "billing_exempt_user_id" uuid;

ALTER TABLE public."v2_restaurants" ADD COLUMN IF NOT EXISTS "billing_current_period_end" timestamp with time zone;

ALTER TABLE public."v2_restaurants" ADD COLUMN IF NOT EXISTS "billing_cancel_at_period_end" boolean DEFAULT false NOT NULL;

ALTER TABLE public."v2_restaurants" ADD COLUMN IF NOT EXISTS "billing_event_created" bigint DEFAULT 0 NOT NULL;

ALTER TABLE public."v2_restaurants" ADD COLUMN IF NOT EXISTS "lemon_subscription_id" text;

ALTER TABLE public."v2_restaurants" ADD COLUMN IF NOT EXISTS "lemon_customer_id" text;

ALTER TABLE public."v2_restaurants" ADD COLUMN IF NOT EXISTS "lemon_updated_at" timestamp with time zone;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_billing_events'::regclass AND conname='v2_billing_events_pkey') THEN ALTER TABLE public."v2_billing_events" ADD CONSTRAINT "v2_billing_events_pkey" PRIMARY KEY (event_id); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_billing_state'::regclass AND conname='v2_billing_state_pkey') THEN ALTER TABLE public."v2_billing_state" ADD CONSTRAINT "v2_billing_state_pkey" PRIMARY KEY (restaurant_id); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_lemon_checkouts'::regclass AND conname='v2_lemon_checkouts_billing_cycle_check') THEN ALTER TABLE public."v2_lemon_checkouts" ADD CONSTRAINT "v2_lemon_checkouts_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['month'::text, 'year'::text]))); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_lemon_checkouts'::regclass AND conname='v2_lemon_checkouts_checkout_id_key') THEN ALTER TABLE public."v2_lemon_checkouts" ADD CONSTRAINT "v2_lemon_checkouts_checkout_id_key" UNIQUE (checkout_id); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_lemon_checkouts'::regclass AND conname='v2_lemon_checkouts_pkey') THEN ALTER TABLE public."v2_lemon_checkouts" ADD CONSTRAINT "v2_lemon_checkouts_pkey" PRIMARY KEY (id); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_lemon_checkouts'::regclass AND conname='v2_lemon_checkouts_plan_code_check') THEN ALTER TABLE public."v2_lemon_checkouts" ADD CONSTRAINT "v2_lemon_checkouts_plan_code_check" CHECK ((plan_code = ANY (ARRAY['basic'::text, 'intermediate'::text, 'advanced'::text]))); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_lemon_checkouts'::regclass AND conname='v2_lemon_checkouts_subscription_id_key') THEN ALTER TABLE public."v2_lemon_checkouts" ADD CONSTRAINT "v2_lemon_checkouts_subscription_id_key" UNIQUE (subscription_id); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_registration_intents'::regclass AND conname='v2_registration_intents_billing_cycle_check') THEN ALTER TABLE public."v2_registration_intents" ADD CONSTRAINT "v2_registration_intents_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['month'::text, 'year'::text]))); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_registration_intents'::regclass AND conname='v2_registration_intents_currency_check') THEN ALTER TABLE public."v2_registration_intents" ADD CONSTRAINT "v2_registration_intents_currency_check" CHECK ((currency = ANY (ARRAY['GTQ'::text, 'USD'::text, 'MXN'::text]))); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_registration_intents'::regclass AND conname='v2_registration_intents_email_key') THEN ALTER TABLE public."v2_registration_intents" ADD CONSTRAINT "v2_registration_intents_email_key" UNIQUE (email); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_registration_intents'::regclass AND conname='v2_registration_intents_language_check') THEN ALTER TABLE public."v2_registration_intents" ADD CONSTRAINT "v2_registration_intents_language_check" CHECK ((language = ANY (ARRAY['es'::text, 'en'::text]))); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_registration_intents'::regclass AND conname='v2_registration_intents_pkey') THEN ALTER TABLE public."v2_registration_intents" ADD CONSTRAINT "v2_registration_intents_pkey" PRIMARY KEY (token); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_registration_intents'::regclass AND conname='v2_registration_intents_plan_code_check') THEN ALTER TABLE public."v2_registration_intents" ADD CONSTRAINT "v2_registration_intents_plan_code_check" CHECK ((plan_code = ANY (ARRAY['basic'::text, 'intermediate'::text, 'advanced'::text]))); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_restaurants'::regclass AND conname='v2_restaurants_billing_cycle_check') THEN ALTER TABLE public."v2_restaurants" ADD CONSTRAINT "v2_restaurants_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['month'::text, 'year'::text]))); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_billing_events'::regclass AND conname='v2_billing_events_restaurant_id_fkey') THEN ALTER TABLE public."v2_billing_events" ADD CONSTRAINT "v2_billing_events_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES v2_restaurants(id) ON DELETE CASCADE; END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_billing_state'::regclass AND conname='v2_billing_state_restaurant_id_fkey') THEN ALTER TABLE public."v2_billing_state" ADD CONSTRAINT "v2_billing_state_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES v2_restaurants(id) ON DELETE CASCADE; END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_lemon_checkouts'::regclass AND conname='v2_lemon_checkouts_owner_id_fkey') THEN ALTER TABLE public."v2_lemon_checkouts" ADD CONSTRAINT "v2_lemon_checkouts_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id); END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_lemon_checkouts'::regclass AND conname='v2_lemon_checkouts_restaurant_id_fkey') THEN ALTER TABLE public."v2_lemon_checkouts" ADD CONSTRAINT "v2_lemon_checkouts_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES v2_restaurants(id) ON DELETE CASCADE; END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_registration_intents'::regclass AND conname='v2_registration_intents_user_id_fkey') THEN ALTER TABLE public."v2_registration_intents" ADD CONSTRAINT "v2_registration_intents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; END IF; END $constraint$;

DO $constraint$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.v2_restaurants'::regclass AND conname='v2_restaurants_billing_exempt_user_id_fkey') THEN ALTER TABLE public."v2_restaurants" ADD CONSTRAINT "v2_restaurants_billing_exempt_user_id_fkey" FOREIGN KEY (billing_exempt_user_id) REFERENCES auth.users(id) ON DELETE SET NULL; END IF; END $constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS v2_billing_customer_unique ON public.v2_restaurants USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS v2_billing_subscription_unique ON public.v2_restaurants USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS v2_lemon_checkout_order ON public.v2_lemon_checkouts USING btree (order_id) WHERE (order_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS v2_lemon_checkout_restaurant ON public.v2_lemon_checkouts USING btree (restaurant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS v2_lemon_subscription_unique ON public.v2_restaurants USING btree (lemon_subscription_id) WHERE (lemon_subscription_id IS NOT NULL);

UPDATE public.v2_restaurants r SET billing_exempt_user_id=u.id
FROM auth.users u
WHERE r.owner_id=u.id AND lower(u.email)='marcelorma96@gmail.com'
AND u.email_confirmed_at IS NOT NULL AND r.billing_exempt_user_id IS DISTINCT FROM u.id;
-- Defaults affect future registrations only, never existing trial dates.
ALTER TABLE public.v2_restaurants ALTER COLUMN trial_ends_at SET DEFAULT (now()+interval '5 days');
ALTER TABLE public.v2_restaurants ALTER COLUMN billing_enforcement_enabled SET DEFAULT true;


SET LOCAL check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.v2_account_billing(p_restaurant uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('id',r.id,'name',r.name,'plan_code',case when public.v2_billing_exempt(r.id) then 'advanced' else r.plan_code end,'trial_ends_at',r.trial_ends_at,
 'subscription_status',r.subscription_status,'access_status',r.access_status,'billing_enforcement_enabled',r.billing_enforcement_enabled,
 'grace_ends_at',r.grace_ends_at,'export_until',r.export_until,'billing_cycle',r.billing_cycle,
 'billing_current_period_end',r.billing_current_period_end,'billing_cancel_at_period_end',r.billing_cancel_at_period_end,
 'can_write',public.v2_billing_can_write(r.id),'trial_exempt',public.v2_billing_exempt(r.id),'is_owner',r.owner_id=auth.uid())
 from public.v2_restaurants r where r.id=p_restaurant and public.v2_can_read(r.id);
$function$;

REVOKE ALL ON FUNCTION public.v2_account_billing(uuid) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_account_billing(uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION public.v2_all_quotes_report_rows(p_restaurant_id uuid, p_kind text, p_from date, p_to date, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS TABLE(row_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
begin
 if not public.v2_current_admin(p_restaurant_id) then raise exception 'Acceso denegado.' using errcode='42501'; end if;
 if p_kind <> 'allquotes' then raise exception 'Reporte no permitido.'; end if;
 if p_from is null or p_to is null or p_to<p_from then raise exception 'Seleccione un período válido.'; end if;
 return query with records as (
  select q.event_date sort_day,q.id,jsonb_build_object(
   'Numero','#'||q.quote_number,'Fecha',to_char(q.event_date,'DD/MM/YYYY'),
   'Cliente',q.client_name,'Telefono',coalesce(q.client_phone,''),'Area',q.area,
   'Estado',q.status,'Total',q.total,'Anticipo',q.deposit,'Saldo',q.balance) data
  from public.v2_quotes q
  where q.restaurant_id=p_restaurant_id and q.deleted_at is null
   and q.event_date between p_from and p_to
 ), filtered as (
  select * from records where coalesce(trim(p_search),'')='' or data::text ilike '%'||trim(p_search)||'%'
 )
 select data,count(*) over() from filtered order by sort_day desc,id
 offset greatest(p_offset,0) limit least(greatest(p_limit,1),1000);
end $function$;

REVOKE ALL ON FUNCTION public.v2_all_quotes_report_rows(uuid, text, date, date, text, integer, integer) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_all_quotes_report_rows(uuid, text, date, date, text, integer, integer) TO "authenticated";

CREATE OR REPLACE FUNCTION public.v2_begin_registration(p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_email text:=lower(btrim(p_data->>'email')); v_token uuid;
begin
 if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or nullif(btrim(p_data->>'full_name'),'') is null or nullif(btrim(p_data->>'restaurant_name'),'') is null then
  raise exception 'Revise su nombre, restaurante y correo.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_email,3421));
 if exists(select 1 from auth.users where lower(email)=v_email) then
  raise exception 'Utilice Iniciar sesión o recuperar contraseña para esta cuenta.';
 end if;
 if exists(select 1 from public.v2_registration_intents where email=v_email and consumed_at is null and created_at>now()-interval '2 minutes') then
  raise exception 'El registro está en curso. Revise su correo o espere dos minutos antes de reintentar.';
 end if;
 delete from public.v2_registration_intents where email=v_email and consumed_at is null;
 insert into public.v2_registration_intents(email,full_name,restaurant_name,phone,country,language,currency,plan_code,billing_cycle)
 values(v_email,left(btrim(p_data->>'full_name'),120),left(btrim(p_data->>'restaurant_name'),160),left(coalesce(p_data->>'phone',''),40),
 left(coalesce(p_data->>'country','Guatemala'),80),p_data->>'language',p_data->>'currency',p_data->>'plan_code',p_data->>'billing_cycle')
 returning token into v_token;
 return v_token;
end $function$;

REVOKE ALL ON FUNCTION public.v2_begin_registration(jsonb) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_begin_registration(jsonb) TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_billing_acquire(p_restaurant uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.v2_billing_state%rowtype;
begin
 insert into public.v2_billing_state(restaurant_id) values(p_restaurant) on conflict do nothing;
 select * into s from public.v2_billing_state where restaurant_id=p_restaurant for update;
 if s.lease_until>now() then return null; end if;
 update public.v2_billing_state set lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds'
 where restaurant_id=p_restaurant returning * into s;
 return to_jsonb(s);
end $function$;

REVOKE ALL ON FUNCTION public.v2_billing_acquire(uuid) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_billing_acquire(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_billing_can_write(p_restaurant uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select coalesce((select r.access_status not in ('suspended','deleted') and (
 not r.billing_enforcement_enabled or public.v2_billing_exempt(r.id)
 or r.trial_ends_at>now()
 or (r.subscription_status='active' and r.billing_current_period_end>now())
 or (r.subscription_status='past_due' and r.grace_ends_at>now())
 ) from public.v2_restaurants r where r.id=p_restaurant),false);
$function$;

REVOKE ALL ON FUNCTION public.v2_billing_can_write(uuid) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_billing_can_write(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.v2_billing_can_write(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_billing_exempt(p_restaurant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.v2_restaurants r WHERE r.id=p_restaurant AND r.billing_exempt_user_id IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.v2_billing_exempt(uuid) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_billing_exempt(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.v2_billing_exempt(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_finish_registration()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u auth.users%rowtype; i public.v2_registration_intents%rowtype; rid uuid; is_exempt boolean;
begin
 if auth.uid() is null then raise exception 'Acceso no autorizado'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,3422));
 select * into u from auth.users where id=auth.uid();
 if u.email_confirmed_at is null or u.invited_at is not null then raise exception 'Acceso no autorizado'; end if;
 select restaurant_id into rid from public.v2_members where user_id=u.id and status='activo' limit 1;
 if rid is not null then return rid; end if;
 select * into i from public.v2_registration_intents where email=lower(u.email)
 and token::text=u.raw_user_meta_data->>'registration_token' for update;
 if i.token is null or i.consumed_at is not null or u.created_at < i.created_at-interval '5 seconds'
    or exists(select 1 from public.v2_members where user_id=u.id) then raise exception 'Acceso no autorizado'; end if;
 is_exempt := false; -- New restaurants never inherit the pilot exemption by email.
 insert into public.v2_restaurants(owner_id,name,phone,country,language,currency,plan_code,billing_cycle,
  trial_started_at,trial_ends_at,subscription_status,access_status,billing_enforcement_enabled,billing_exempt_user_id)
 values(u.id,i.restaurant_name,i.phone,i.country,i.language,i.currency,i.plan_code,i.billing_cycle,
  now(),now()+interval '5 days','trialing','trialing',true,case when is_exempt then u.id end) returning id into rid;
 insert into public.v2_members(restaurant_id,user_id,name,email,role,status)
 values(rid,u.id,i.full_name,lower(u.email),'administrador','activo');
 update public.v2_registration_intents set consumed_at=now(),user_id=u.id where token=i.token;
 perform public.v2_accept_legal('2026-09-10','Registro web MRMAA');
 return rid;
end $function$;

REVOKE ALL ON FUNCTION public.v2_finish_registration() FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_finish_registration() TO "authenticated";

CREATE OR REPLACE FUNCTION public.v2_followup_report_rows(p_restaurant_id uuid, p_kind text, p_from date, p_to date, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50, p_timezone text DEFAULT 'UTC'::text)
 RETURNS TABLE(row_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
begin
 if not public.v2_current_admin(p_restaurant_id) then raise exception 'Acceso denegado.' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'Seleccione un período válido de hasta 366 días.'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Zona horaria inválida.'; end if;
 if p_kind='balances' then
  return query with records as (
   select q.event_date sort_day,q.id,jsonb_build_object('Fecha',to_char(q.event_date,'DD/MM/YYYY'),
    'Cliente',q.client_name,'Numero',q.quote_number,'Total',q.total,'Anticipo',q.deposit,'Saldo',q.balance) data
   from v2_quotes q where q.restaurant_id=p_restaurant_id and q.deleted_at is null and q.balance>0
    and q.event_date between greatest(p_from,(now() at time zone p_timezone)::date) and p_to
    and exists(select 1 from v2_reservations r where r.restaurant_id=p_restaurant_id and r.quote_id=q.id and r.deleted_at is null and r.status<>'cancelada')
  ), filtered as(select * from records where coalesce(trim(p_search),'')='' or data::text ilike '%'||trim(p_search)||'%')
  select data,count(*) over() from filtered order by sort_day,id offset greatest(p_offset,0) limit least(greatest(p_limit,1),1000);
 elsif p_kind='leadtime' then
  return query with source as (
   select r.event_date-(r.created_at at time zone p_timezone)::date days
   from v2_reservations r where r.restaurant_id=p_restaurant_id and r.deleted_at is null
    and r.status<>'cancelada' and r.event_date between p_from and p_to
  ), grouped as (
   select case when days is null or days<0 then 'Registro posterior o sin fecha'
    when days=0 then 'Mismo día' when days<=3 then '1–3 días' when days<=7 then '4–7 días'
    when days<=30 then '8–30 días' else 'Más de 30 días' end label,
    case when days is null or days<0 then 6 when days=0 then 0 when days<=3 then 1 when days<=7 then 2 when days<=30 then 3 else 4 end pos,count(*) n
   from source group by 1,2
  ), records as(select pos,jsonb_build_object('Anticipación',label,'Reservaciones',n,'Porcentaje (%)',round(100.0*n/nullif(sum(n) over(),0),2)) data from grouped),
  filtered as(select * from records where coalesce(trim(p_search),'')='' or data::text ilike '%'||trim(p_search)||'%')
  select data,count(*) over() from filtered order by pos offset greatest(p_offset,0) limit least(greatest(p_limit,1),1000);
 elsif p_kind='comparison' then
  return query with periods as (
   select 1 pos,p_from start_day,p_to end_day union all select 0,p_from-(p_to-p_from+1),p_from-1
  ), measures as (
   select p.pos, r.n,r.guests,r.cancelled,q.n quotes,q.converted
   from periods p cross join lateral (
    select count(*) n,coalesce(sum(guests) filter(where status<>'cancelada'),0) guests,count(*) filter(where status='cancelada') cancelled
    from v2_reservations where restaurant_id=p_restaurant_id and deleted_at is null and event_date between p.start_day and p.end_day
   ) r cross join lateral (
    select count(*) n,count(*) filter(where exists(select 1 from v2_reservations x where x.restaurant_id=p_restaurant_id and x.quote_id=q.id and x.deleted_at is null and x.status<>'cancelada')) converted
    from v2_quotes q where q.restaurant_id=p_restaurant_id and q.deleted_at is null and q.event_date between p.start_day and p.end_day
   ) q
  ), metrics as (
   select pos,v.label,v.value from measures cross join lateral(values
    ('Reservaciones',n::numeric),('Invitados',guests::numeric),('Canceladas',cancelled::numeric),
    ('Cotizaciones',quotes::numeric),('Conversión (%)',round(100.0*converted/nullif(quotes,0),2))
   )v(label,value)
  ), records as(
   select label,jsonb_build_object('Indicador',label,'Actual',max(value) filter(where pos=1),
    'Anterior',max(value) filter(where pos=0),'Diferencia',max(value) filter(where pos=1)-max(value) filter(where pos=0)) data
   from metrics group by label
  ), filtered as(select * from records where coalesce(trim(p_search),'')='' or data::text ilike '%'||trim(p_search)||'%')
  select data,count(*) over() from filtered order by label offset greatest(p_offset,0) limit least(greatest(p_limit,1),1000);
 else raise exception 'Reporte no permitido.';
 end if;
end $function$;

REVOKE ALL ON FUNCTION public.v2_followup_report_rows(uuid, text, date, date, text, integer, integer, text) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_followup_report_rows(uuid, text, date, date, text, integer, integer, text) TO "authenticated";

CREATE OR REPLACE FUNCTION public.v2_guard_member_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare n integer; lim integer;
begin
 if new.status not in ('activo','invitado') then return new; end if;
 if tg_op='UPDATE' and old.restaurant_id=new.restaurant_id and old.status in ('activo','invitado') then return new; end if;
 perform 1 from public.v2_restaurants where id=new.restaurant_id for update;
 lim:=public.v2_plan_user_limit(new.restaurant_id);
 select count(*) into n from public.v2_members where restaurant_id=new.restaurant_id and status in ('activo','invitado') and user_id<>new.user_id;
 if n>=lim then raise exception 'Su plan alcanzó el límite de usuarios. Cancele una invitación o cambie de plan.'; end if;
 return new;
end $function$;

REVOKE ALL ON FUNCTION public.v2_guard_member_limit() FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_guard_member_limit() TO "anon";

GRANT EXECUTE ON FUNCTION public.v2_guard_member_limit() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.v2_guard_member_limit() TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_guard_paid_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare data jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; rid uuid;
begin
 if tg_table_name='v2_restaurants' and tg_op='INSERT' then return new; end if;
 if tg_table_name='v2_restaurants' then rid:=(data->>'id')::uuid;
 elsif tg_table_name='v2_quote_items' then select restaurant_id into rid from public.v2_quotes where id=(data->>'quote_id')::uuid;
 else rid:=(data->>'restaurant_id')::uuid; end if;
 -- Las operaciones del servidor usan service_role. Las RPC con SECURITY DEFINER
 -- conservan auth.uid(): tampoco pueden eludir la fecha de vencimiento.
 if auth.uid() is not null and rid is not null and not public.v2_billing_can_write(rid) then
  raise exception 'Su prueba o suscripción terminó. Active un plan para realizar cambios.';
 end if;
 if auth.uid() is not null and tg_table_name in ('v2_areas','v2_employees','v2_shifts','v2_schedules')
    and not public.v2_plan_has_schedules(rid) then
  raise exception 'Horarios y empleados requieren un plan Intermedio o Avanzado.';
 end if;
 return case when tg_op='DELETE' then old else new end;
end $function$;

REVOKE ALL ON FUNCTION public.v2_guard_paid_write() FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_guard_paid_write() TO "anon";

GRANT EXECUTE ON FUNCTION public.v2_guard_paid_write() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.v2_guard_paid_write() TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_guard_resource_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare lim bigint; used bigint; plan text;
begin
 if new.deleted_at is not null or public.v2_billing_exempt(new.restaurant_id) then return new; end if;
 if tg_op='UPDATE' then
  if old.deleted_at is null and old.restaurant_id=new.restaurant_id then return new; end if;
 end if;
 select r.plan_code into plan from public.v2_restaurants r where r.id=new.restaurant_id;
 select case tg_table_name when 'v2_clients' then p.max_clients
  when 'v2_quotes' then p.max_quotes when 'v2_reservations' then p.max_reservations end
 into lim from public.v2_plan_limits p where p.plan_code=plan;
 if lim is null then return new; end if;
 perform pg_advisory_xact_lock(hashtext('v2_resource_limit:'||tg_table_name||':'||new.restaurant_id::text));
 execute format('select count(*) from public.%I where restaurant_id=$1 and deleted_at is null',tg_table_name)
  into used using new.restaurant_id;
 if used>=lim then raise exception 'Su plan alcanzó el límite de registros. Cambie de plan para continuar.' using errcode='P0001'; end if;
 return new;
end $function$;

REVOKE ALL ON FUNCTION public.v2_guard_resource_limit() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.v2_lemon_apply(p_event text, p_updated timestamp with time zone, p_attempt uuid, p_lease uuid, p_store text, p_variant text, p_customer text, p_subscription text, p_order text, p_status text, p_paid_until timestamp with time zone, p_cancel_at_end boolean, p_ended_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a public.v2_lemon_checkouts%rowtype; r public.v2_restaurants%rowtype; s public.v2_billing_state%rowtype; old_created timestamptz;
begin
 select * into a from public.v2_lemon_checkouts where id=p_attempt;
 if a.id is null then raise exception 'Referencia de pago no válida'; end if;
 select * into s from public.v2_billing_state where restaurant_id=a.restaurant_id for update;
 if s.lease_token is distinct from p_lease or s.lease_until is null or s.lease_until<=now() then raise exception 'Operación de pago vencida'; end if;
 select * into r from public.v2_restaurants where id=a.restaurant_id for update;
 if r.id is null or a.owner_id<>r.owner_id or a.store_id is distinct from p_store or a.variant_id is distinct from p_variant
  or p_subscription is null or p_customer is null or p_updated is null
  or (a.subscription_id is not null and a.subscription_id<>p_subscription)
  or (a.customer_id is not null and a.customer_id<>p_customer)
  or (a.order_id is not null and a.order_id is distinct from p_order) then raise exception 'Referencia de pago no válida'; end if;
 if p_status is null or p_status not in ('active','past_due','cancelled')
  or p_event is null or p_event !~ '^lemon_test_[a-f0-9]{64}$'
  or (p_status='active' and (p_paid_until is null or p_paid_until<=now())) then raise exception 'Estado de cobro no válido'; end if;
 if r.lemon_subscription_id is not null and r.lemon_subscription_id<>p_subscription then
  select created_at into old_created from public.v2_lemon_checkouts where subscription_id=r.lemon_subscription_id;
  -- Delayed events from an older subscription must never replace its successor.
  if old_created is not null and a.created_at<=old_created then return false; end if;
  if r.subscription_status<>'cancelled' or r.billing_current_period_end>now() then raise exception 'Suscripción adicional requiere revisión'; end if;
 end if;
 if r.lemon_subscription_id=p_subscription and p_updated<r.lemon_updated_at then return false; end if;
 insert into public.v2_billing_events(event_id,restaurant_id,event_created)
 values(p_event,r.id,(extract(epoch from p_updated)*1000)::bigint) on conflict do nothing;
 if not found then return false; end if;
 update public.v2_lemon_checkouts set subscription_id=p_subscription,customer_id=p_customer,order_id=p_order where id=p_attempt;
 update public.v2_restaurants set
  lemon_subscription_id=p_subscription,lemon_customer_id=p_customer,lemon_updated_at=p_updated,
  plan_code=case when p_status='active' then a.plan_code else plan_code end,
  billing_cycle=case when p_status='active' then a.billing_cycle else billing_cycle end,
  subscription_status=p_status,
  access_status=case when access_status in ('suspended','deleted') then access_status
   when p_status='active' then 'active' when trial_ends_at>now() then 'trialing'
   when p_status='past_due' then 'past_due' else 'cancelled' end,
  billing_current_period_end=case when p_status='active' then p_paid_until
   when p_status='cancelled' then least(billing_current_period_end,coalesce(p_ended_at,now())) else billing_current_period_end end,
  grace_ends_at=case when p_status='past_due' and billing_current_period_end is not null then billing_current_period_end+interval '5 days' else null end,
  billing_cancel_at_period_end=p_cancel_at_end,export_until=null,billing_enforcement_enabled=true
 where id=r.id;
 return true;
end $function$;

REVOKE ALL ON FUNCTION public.v2_lemon_apply(text, timestamp with time zone, uuid, uuid, text, text, text, text, text, text, timestamp with time zone, boolean, timestamp with time zone) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_lemon_apply(text, timestamp with time zone, uuid, uuid, text, text, text, text, text, text, timestamp with time zone, boolean, timestamp with time zone) TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_operational_report_rows(p_restaurant_id uuid, p_kind text, p_from date, p_to date, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS TABLE(row_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
begin
 if not public.v2_current_admin(p_restaurant_id) then
  raise exception 'Acceso denegado.' using errcode='42501';
 end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then
  raise exception 'Seleccione un período válido de hasta 366 días.';
 end if;
 if p_kind='conversion' then
  return query
  with grouped as (
   select q.event_date as event_day, coalesce(nullif(trim(q.area),''),'Sin área') area,
    count(*) n, count(*) filter(where exists(
     select 1 from public.v2_reservations r where r.restaurant_id=p_restaurant_id
      and r.quote_id=q.id and r.deleted_at is null and r.status<>'cancelada'
    )) converted
   from public.v2_quotes q
   where q.restaurant_id=p_restaurant_id and q.deleted_at is null
    and q.event_date between p_from and p_to
   group by q.event_date,coalesce(nullif(trim(q.area),''),'Sin área')
  ), rows as (
   select event_day,area,jsonb_build_object('Fecha',to_char(event_day,'DD/MM/YYYY'),'Area',area,
    'Cotizaciones',n,'Convertidas',converted,'ConversionPct',round(100.0*converted/nullif(n,0),2)) data from grouped
  ), filtered as(select * from rows where coalesce(trim(p_search),'')='' or data::text ilike '%'||trim(p_search)||'%')
  select data,count(*) over() from filtered order by event_day desc,area
   offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,50),1),1000);
 elsif p_kind in ('cancellations','demand') then
  return query
  with grouped as (
   select r.event_date as event_day,coalesce(left(r.event_time::text,2)||':00','Sin hora') as event_hour,
    coalesce(nullif(trim(r.area),''),'Sin área') area,
    count(*) n,count(*) filter(where r.status='cancelada') cancelled,
    coalesce(sum(r.guests),0) guests
   from public.v2_reservations r
   where r.restaurant_id=p_restaurant_id and r.deleted_at is null
    and r.event_date between p_from and p_to
    and (p_kind='cancellations' or r.status<>'cancelada')
   group by r.event_date,coalesce(left(r.event_time::text,2)||':00','Sin hora'),coalesce(nullif(trim(r.area),''),'Sin área')
  ), rows as (
   select event_day,event_hour,area,jsonb_build_object('Fecha',to_char(event_day,'DD/MM/YYYY'),'Hora',event_hour,'Area',area,
    'Reservaciones',n) || case when p_kind='cancellations' then
     jsonb_build_object('Canceladas',cancelled,'CancelacionPct',round(100.0*cancelled/nullif(n,0),2))
     else jsonb_build_object('Invitados',guests) end data from grouped
  ), filtered as(select * from rows where coalesce(trim(p_search),'')='' or data::text ilike '%'||trim(p_search)||'%')
  select data,count(*) over() from filtered order by event_day desc,event_hour,area
   offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,50),1),1000);
 else raise exception 'Reporte no permitido.';
 end if;
end $function$;

REVOKE ALL ON FUNCTION public.v2_operational_report_rows(uuid, text, date, date, text, integer, integer) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_operational_report_rows(uuid, text, date, date, text, integer, integer) TO "authenticated";

CREATE OR REPLACE FUNCTION public.v2_plan_has_schedules(p_restaurant uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select coalesce((select public.v2_billing_exempt(id) or plan_code in ('intermediate','advanced') from public.v2_restaurants where id=p_restaurant),false);
$function$;

REVOKE ALL ON FUNCTION public.v2_plan_has_schedules(uuid) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_plan_has_schedules(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.v2_plan_has_schedules(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_plan_user_limit(p_restaurant uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select case when public.v2_billing_exempt(id) then 2147483647 else case plan_code when 'basic' then 1 when 'intermediate' then 5 when 'advanced' then 15 else 0 end end
 from public.v2_restaurants where id=p_restaurant;
$function$;

REVOKE ALL ON FUNCTION public.v2_plan_user_limit(uuid) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_plan_user_limit(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.v2_plan_user_limit(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_record_activity(target_restaurant uuid, activity text, section text, details jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_actor_name text;
  current_actor_role text;
begin
  if activity not in ('excel_exportado', 'impresion') then
    raise exception 'Actividad no permitida';
  end if;

  select coalesce(nullif(name, ''), nullif(email, ''), 'Usuario'), role
    into current_actor_name, current_actor_role
  from public.v2_members
  where restaurant_id=target_restaurant
    and user_id=auth.uid()
    and coalesce(status, 'activo')='activo'
  limit 1;

  if current_actor_role is null then
    raise exception 'Acceso no autorizado';
  end if;

  insert into public.v2_audit_log(
    restaurant_id, table_name, record_id, action, new_data,
    changed_by, actor_name, actor_role
  ) values (
    target_restaurant,
    left(coalesce(nullif(section, ''), 'sistema'), 80),
    target_restaurant,
    activity,
    coalesce(details, '{}'::jsonb),
    auth.uid(),
    current_actor_name,
    current_actor_role
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.v2_record_activity(uuid, text, text, jsonb) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_record_activity(uuid, text, text, jsonb) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.v2_record_activity(uuid, text, text, jsonb) TO "service_role";

CREATE OR REPLACE FUNCTION public.v2_save_quote(p_restaurant uuid, p_quote_id uuid, p_payload jsonb, p_items jsonb)
 RETURNS TABLE(id uuid, quote_number integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_number integer;
  v_start integer;
begin
  if not public.v2_can_operate(p_restaurant) then
    raise exception 'Acceso denegado.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_payload->>'client_name','')),'') is null then
    raise exception 'El nombre del cliente es obligatorio.' using errcode = '22023';
  end if;
  if nullif(p_payload->>'event_date','') is null then
    raise exception 'La fecha del evento es obligatoria.' using errcode = '22023';
  end if;

  if not exists(select 1 from public.v2_reservation_areas a
    where a.restaurant_id=p_restaurant and a.active and a.id=nullif(p_payload->>'area_id','')::uuid) then
    raise exception 'Configure y seleccione un área en Configuración → Reservaciones antes de guardar.' using errcode='22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Los productos deben ser una lista.' using errcode='22023';
  end if;
  if nullif(p_payload->>'client_id','') is not null and not exists (
    select 1 from public.v2_clients c where c.id=(p_payload->>'client_id')::uuid
      and c.restaurant_id=p_restaurant and c.deleted_at is null
  ) then raise exception 'Cliente no disponible.' using errcode='22023'; end if;

  -- Serializa la asignación de número por restaurante; evita la carrera que
  -- antes se resolvía con lecturas + reintentos desde el navegador.
  perform pg_advisory_xact_lock(hashtext('v2_save_quote:' || p_restaurant::text));

  if p_quote_id is null then
    select r.quote_number_start into v_start from public.v2_restaurants r where r.id = p_restaurant;
    select greatest(coalesce(v_start, 2000), coalesce(max(q.quote_number), coalesce(v_start, 2000) - 1) + 1)
      into v_number from public.v2_quotes q where q.restaurant_id = p_restaurant;

    insert into public.v2_quotes as q (
      restaurant_id, client_id, client_name, client_phone, client_email,
      event_date, event_time, area, area_id, guests, discount_pct, tip_pct,
      subtotal, total, deposit, payment_method, balance, customer_note,
      internal_notes, custom_fields, adjustments, status, quote_number
    ) values (
      p_restaurant,
      nullif(p_payload->>'client_id','')::uuid, trim(p_payload->>'client_name'),
      trim(coalesce(p_payload->>'client_phone','')), trim(coalesce(p_payload->>'client_email','')),
      (p_payload->>'event_date')::date, nullif(p_payload->>'event_time','')::time,
      trim(coalesce(p_payload->>'area','')), nullif(p_payload->>'area_id','')::uuid,
      coalesce((p_payload->>'guests')::integer, 0),
      coalesce((p_payload->>'discount_pct')::numeric, 0), coalesce((p_payload->>'tip_pct')::numeric, 0),
      coalesce((p_payload->>'subtotal')::numeric, 0), coalesce((p_payload->>'total')::numeric, 0),
      coalesce((p_payload->>'deposit')::numeric, 0), coalesce(p_payload->>'payment_method',''),
      coalesce((p_payload->>'balance')::numeric, 0), trim(coalesce(p_payload->>'customer_note','')),
      trim(coalesce(p_payload->>'internal_notes','')),
      coalesce(p_payload->'custom_fields','{}'::jsonb), coalesce(p_payload->'adjustments','[]'::jsonb),
      'pendiente', v_number
    ) returning q.id into v_id;
  else
    perform 1 from public.v2_quotes q where q.id = p_quote_id and q.restaurant_id = p_restaurant and q.deleted_at is null for update;
    if not found then
      raise exception 'Cotización no encontrada.' using errcode = 'P0002';
    end if;
    v_id := p_quote_id;
    select q.quote_number into v_number from public.v2_quotes q where q.id = v_id;

    update public.v2_quotes as q set
      client_id = nullif(p_payload->>'client_id','')::uuid, client_name = trim(p_payload->>'client_name'),
      client_phone = trim(coalesce(p_payload->>'client_phone','')), client_email = trim(coalesce(p_payload->>'client_email','')),
      event_date = (p_payload->>'event_date')::date, event_time = nullif(p_payload->>'event_time','')::time,
      area = trim(coalesce(p_payload->>'area','')), area_id = nullif(p_payload->>'area_id','')::uuid,
      guests = coalesce((p_payload->>'guests')::integer, 0),
      discount_pct = coalesce((p_payload->>'discount_pct')::numeric, 0), tip_pct = coalesce((p_payload->>'tip_pct')::numeric, 0),
      subtotal = coalesce((p_payload->>'subtotal')::numeric, 0), total = coalesce((p_payload->>'total')::numeric, 0),
      deposit = coalesce((p_payload->>'deposit')::numeric, 0), payment_method = coalesce(p_payload->>'payment_method',''),
      balance = coalesce((p_payload->>'balance')::numeric, 0), customer_note = trim(coalesce(p_payload->>'customer_note','')),
      internal_notes = trim(coalesce(p_payload->>'internal_notes','')),
      custom_fields = coalesce(p_payload->'custom_fields','{}'::jsonb), adjustments = coalesce(p_payload->'adjustments','[]'::jsonb),
      updated_at = now()
    where q.id = v_id;

    delete from public.v2_quote_items where v2_quote_items.quote_id = v_id;
  end if;

  insert into public.v2_quote_items (quote_id, position, name, description, quantity, unit_price, line_total)
  select v_id, (ord - 1)::integer, item->>'name', nullif(item->>'description',''),
    coalesce((item->>'quantity')::numeric, 0), coalesce((item->>'unit_price')::numeric, 0),
    coalesce((item->>'quantity')::numeric, 0) * coalesce((item->>'unit_price')::numeric, 0)
  from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  where nullif(trim(coalesce(item->>'name','')),'') is not null;

  return query select v_id, v_number;
end;
$function$;

REVOKE ALL ON FUNCTION public.v2_save_quote(uuid, uuid, jsonb, jsonb) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_save_quote(uuid, uuid, jsonb, jsonb) TO "authenticated";

CREATE OR REPLACE FUNCTION public.v2_write_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  before_row jsonb := case when tg_op='INSERT' then null else to_jsonb(old) end;
  after_row jsonb := case when tg_op='DELETE' then null else to_jsonb(new) end;
  rid uuid := coalesce((after_row->>'restaurant_id')::uuid,(before_row->>'restaurant_id')::uuid);
  rec_id uuid;
  rid_action text;
  current_actor_name text;
  current_actor_role text;
begin
  if tg_op='INSERT' then rid_action := 'creado'; rec_id := new.id;
  elsif tg_op='DELETE' then rid_action := 'eliminado_definitivamente'; rec_id := old.id;
  elsif old.deleted_at is null and new.deleted_at is not null then rid_action := 'enviado_papelera';
  elsif old.deleted_at is not null and new.deleted_at is null then rid_action := 'restaurado';
  else rid_action := 'modificado';
  end if;
  if tg_op='UPDATE' then rec_id := new.id; end if;

  select coalesce(nullif(name,''),nullif(email,''),'Usuario'), role
  into current_actor_name, current_actor_role
  from public.v2_members
  where restaurant_id=rid and user_id=auth.uid()
  limit 1;

  insert into public.v2_audit_log(
    restaurant_id,table_name,record_id,action,old_data,new_data,changed_by,actor_name,actor_role
  ) values (
    rid,tg_table_name,rec_id,rid_action,before_row,after_row,auth.uid(),coalesce(current_actor_name,'Sistema'),current_actor_role
  );
  return case when tg_op='DELETE' then old else new end;
end $function$;

REVOKE ALL ON FUNCTION public.v2_write_audit() FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.v2_write_audit() TO "service_role";

REVOKE ALL ON FUNCTION public.v2_activate_my_membership() FROM PUBLIC,anon,authenticated;

REVOKE INSERT,UPDATE,DELETE ON public.v2_restaurants FROM authenticated;
GRANT UPDATE(name,owner_name,phone,country,language,currency,quote_number_start,settings,allow_team_excel_exports) ON public.v2_restaurants TO authenticated;

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_areas";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_areas FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_clients";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_clients FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_resource_plan_limit" ON public."v2_clients";
CREATE TRIGGER v2_resource_plan_limit BEFORE INSERT OR UPDATE ON public.v2_clients FOR EACH ROW EXECUTE FUNCTION v2_guard_resource_limit();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_communication_settings";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_communication_settings FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_employees";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_employees FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_member_plan_limit" ON public."v2_members";
CREATE TRIGGER v2_member_plan_limit BEFORE INSERT OR UPDATE ON public.v2_members FOR EACH ROW EXECUTE FUNCTION v2_guard_member_limit();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_members";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_members FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_message_templates";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_message_templates FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_quote_items";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_quote_items FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_quote_products";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_quote_products FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_quotes";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_quotes FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_resource_plan_limit" ON public."v2_quotes";
CREATE TRIGGER v2_resource_plan_limit BEFORE INSERT OR UPDATE ON public.v2_quotes FOR EACH ROW EXECUTE FUNCTION v2_guard_resource_limit();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_reservation_areas";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_reservation_areas FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_reservations";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_reservations FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_resource_plan_limit" ON public."v2_reservations";
CREATE TRIGGER v2_resource_plan_limit BEFORE INSERT OR UPDATE ON public.v2_reservations FOR EACH ROW EXECUTE FUNCTION v2_guard_resource_limit();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_restaurants";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_restaurants FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_schedules";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_schedules FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP TRIGGER IF EXISTS "v2_paid_write" ON public."v2_shifts";
CREATE TRIGGER v2_paid_write BEFORE INSERT OR DELETE OR UPDATE ON public.v2_shifts FOR EACH ROW EXECUTE FUNCTION v2_guard_paid_write();

DROP POLICY IF EXISTS "v2_plan_module" ON "public"."v2_areas";

CREATE POLICY "v2_plan_module" ON "public"."v2_areas" AS RESTRICTIVE FOR ALL TO "authenticated" USING (v2_plan_has_schedules(restaurant_id)) WITH CHECK (v2_plan_has_schedules(restaurant_id));

DROP POLICY IF EXISTS "v2_plan_module" ON "public"."v2_employees";

CREATE POLICY "v2_plan_module" ON "public"."v2_employees" AS RESTRICTIVE FOR ALL TO "authenticated" USING (v2_plan_has_schedules(restaurant_id)) WITH CHECK (v2_plan_has_schedules(restaurant_id));

DROP POLICY IF EXISTS "v2_products_delete" ON "public"."v2_quote_products";

CREATE POLICY "v2_products_delete" ON "public"."v2_quote_products" AS PERMISSIVE FOR DELETE TO "authenticated" USING (v2_current_admin(restaurant_id));

DROP POLICY IF EXISTS "reservation_areas_delete" ON "public"."v2_reservation_areas";

CREATE POLICY "reservation_areas_delete" ON "public"."v2_reservation_areas" AS PERMISSIVE FOR DELETE TO "authenticated" USING (v2_current_admin(restaurant_id));

DROP POLICY IF EXISTS "v2_plan_module" ON "public"."v2_schedules";

CREATE POLICY "v2_plan_module" ON "public"."v2_schedules" AS RESTRICTIVE FOR ALL TO "authenticated" USING (v2_plan_has_schedules(restaurant_id)) WITH CHECK (v2_plan_has_schedules(restaurant_id));

DROP POLICY IF EXISTS "v2_plan_module" ON "public"."v2_shifts";

CREATE POLICY "v2_plan_module" ON "public"."v2_shifts" AS RESTRICTIVE FOR ALL TO "authenticated" USING (v2_plan_has_schedules(restaurant_id)) WITH CHECK (v2_plan_has_schedules(restaurant_id));

DROP POLICY IF EXISTS "mrmaa_branding_admin_select" ON "storage"."objects";

CREATE POLICY "mrmaa_branding_admin_select" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'mrmaa-branding'::text) AND v2_current_admin(((storage.foldername(name))[1])::uuid)));

SET LOCAL check_function_bodies = true;
DO $verify$ DECLARE rid uuid; BEGIN
 SELECT r.id INTO STRICT rid FROM public.v2_restaurants r JOIN auth.users u ON r.owner_id=u.id WHERE lower(u.email)='marcelorma96@gmail.com';
 IF NOT public.v2_billing_exempt(rid) OR NOT public.v2_billing_can_write(rid) OR NOT public.v2_plan_has_schedules(rid) THEN
 RAISE EXCEPTION 'No pasó la comprobación del acceso gratuito del piloto. La migración se revierte.'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'Migración terminada; datos comerciales conservados' AS resultado,
 r.name AS restaurante, public.v2_billing_exempt(r.id) AS piloto_gratuito,
 public.v2_billing_can_write(r.id) AS acceso_habilitado
FROM public.v2_restaurants r JOIN auth.users u ON u.id=r.owner_id
WHERE lower(u.email)='marcelorma96@gmail.com';
