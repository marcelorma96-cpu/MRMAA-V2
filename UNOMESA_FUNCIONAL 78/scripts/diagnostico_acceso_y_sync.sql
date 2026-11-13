-- UNOMESA: SEGUNDA REVISION, ACCESO Y SINCRONIZACION
-- SOLO LECTURA. No instalar como migracion. Ejecutar el archivo completo.
-- Exporta codigo SQL de funciones seleccionadas y metadatos de disparadores.
-- No ejecuta esas funciones ni lee filas de clientes, reservas o cotizaciones.
-- Es codigo interno: revisar el resultado antes de compartirlo.
-- No modifica permisos, exenciones, estructura, indices ni datos.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '1s';
WITH wanted(name) AS (VALUES
 ('v2_accessible_restaurants'),
 ('v2_effective_membership'),
 ('v2_has_role'),
 ('v2_can_read'),
 ('v2_can_operate'),
 ('v2_current_admin'),
 ('v2_mfa_session_allowed'),
 ('v2_session_alive'),
 ('v2_session_is_active'),
 ('v2_support_role'),
 ('v2_is_support_agent'),
 ('v2_guard_tenant_reference'),
 ('v2_guard_paid_write'),
 ('v2_billing_can_write'),
 ('v2_billing_exempt'),
 ('v2_list_page'),
 ('v2_reservation_summary'),
 ('v2_emit_sync_change'),
 ('v2_sync_topic_allowed'),
 ('v2_public_page'),
 ('v2_public_authorize'),
 ('v2_floor_authorize'),
 ('v2_take_rate_limit'),
 ('v2_platform_maintenance'),
 ('v2_retention_delete'),
 ('v2_claim_retention_cleanup')
), triggers AS (
 SELECT t.*,n.nspname AS table_schema,c.relname AS table_name
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal
 AND n.nspname='public' AND c.relname LIKE 'v2\_%' ESCAPE '\'
), functions AS (
 SELECT p.*,n.nspname AS schema_name
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND n.nspname='public'
 AND (p.proname IN (SELECT name FROM wanted) OR p.oid IN (SELECT tgfoid FROM triggers))
)
SELECT jsonb_build_object(
 'generated_at',now(),
 'transaction_read_only',current_setting('transaction_read_only'),
 'selected_functions',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'schema',p.schema_name,'name',p.proname,
   'arguments',pg_get_function_identity_arguments(p.oid),
   'security_definer',p.prosecdef,'definition',pg_get_functiondef(p.oid)
 ) ORDER BY p.proname,p.oid) FROM functions p),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'table',t.table_name,'name',t.tgname,'enabled',t.tgenabled,
   'definition',pg_get_triggerdef(t.oid),
   'function',t.tgfoid::regprocedure::text
 ) ORDER BY t.table_name,t.tgname) FROM triggers t),'[]'::jsonb),
 'public_schema_create',jsonb_build_object(
   'anon',has_schema_privilege('anon','public','CREATE'),
   'authenticated',has_schema_privilege('authenticated','public','CREATE')
 ),
 'index_usage',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'table',s.relname,'index',s.indexrelname,'scans',s.idx_scan,
   'rows_read',s.idx_tup_read,'rows_fetched',s.idx_tup_fetch,
   'bytes',pg_relation_size(s.indexrelid),
   'constraint',(SELECT c.conname FROM pg_constraint c WHERE c.conindid=s.indexrelid
     AND c.contype IN ('p','u','x') LIMIT 1)
 ) ORDER BY s.relname,s.indexrelname) FROM pg_stat_user_indexes s
 WHERE s.schemaname='public' AND s.relname LIKE 'v2\_%' ESCAPE '\'),'[]'::jsonb),
 'database_stats',(SELECT jsonb_build_object('temp_files',temp_files,
   'temp_bytes',temp_bytes,'deadlocks',deadlocks,'stats_reset',stats_reset)
   FROM pg_stat_database WHERE datname=current_database()),
 'query_stats_extension',(SELECT jsonb_build_object('name',e.extname,'schema',n.nspname,
   'version',e.extversion) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
   WHERE e.extname='pg_stat_statements'),
 'scope','Source code and metadata only. No business functions executed. No business rows exported.'
) AS diagnostico_detalle;
ROLLBACK;
