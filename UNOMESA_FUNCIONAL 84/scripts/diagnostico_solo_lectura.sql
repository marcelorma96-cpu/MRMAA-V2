-- UNOMESA / DIAGNOSTICO DE CAPACIDAD Y AISLAMIENTO / 10 OCT 2026
-- Consulta opcional. NO es una migracion. Ejecutar el archivo completo.
-- Solo catalogos, permisos, definiciones de indices/politicas y estadisticas.
-- No lee filas de clientes, correos, reservas, tokens ni contrasenas.
-- No ejecuta funciones de negocio. No cambia estructura ni datos.
-- La transaccion READ ONLY impide escrituras accidentales; termina en ROLLBACK.
-- Ejecutar en Supabase SQL Editor con la cuenta administradora del proyecto.
-- Exportar la celda diagnostico (JSON). No basta con enviar "Success".
-- Un resultado sin errores NO certifica seguridad ni capacidad de carga.
-- Estadisticas son aproximadas y pueden estar desactualizadas.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '1s';
WITH expected_rpc(name) AS (VALUES
 ('v2_accept_legal'),
 ('v2_account_billing'),
 ('v2_account_email_cancel'),
 ('v2_account_email_issue'),
 ('v2_account_email_verify'),
 ('v2_ai_quota'),
 ('v2_begin_registration'),
 ('v2_billing_acquire'),
 ('v2_billing_can_write'),
 ('v2_billing_exempt'),
 ('v2_claim_expiry_notice'),
 ('v2_claim_retention_cleanup'),
 ('v2_current_admin'),
 ('v2_effective_membership'),
 ('v2_email_challenge'),
 ('v2_ensure_restaurant'),
 ('v2_event_inbox_current'),
 ('v2_event_read'),
 ('v2_event_save_task'),
 ('v2_excel_export_access'),
 ('v2_expiry_notice_valid'),
 ('v2_find_duplicate_client'),
 ('v2_find_or_create_client'),
 ('v2_finish_registration'),
 ('v2_finish_retention_cleanup'),
 ('v2_floor_convert_quote'),
 ('v2_floor_form'),
 ('v2_floor_read'),
 ('v2_floor_save_layout'),
 ('v2_floor_save_reservation'),
 ('v2_google_registration_state'),
 ('v2_google_start_trial'),
 ('v2_import_clients'),
 ('v2_import_reservation_warnings'),
 ('v2_import_reservations'),
 ('v2_is_support_agent'),
 ('v2_lemon_apply'),
 ('v2_link_reservation_quote'),
 ('v2_list_page'),
 ('v2_mfa_session_allowed'),
 ('v2_nearby_reservations'),
 ('v2_pin_billing_provider'),
 ('v2_plan_change_status'),
 ('v2_plan_user_limit'),
 ('v2_platform_maintenance'),
 ('v2_public_asset_detach'),
 ('v2_public_asset_reserve'),
 ('v2_public_inbox'),
 ('v2_public_page'),
 ('v2_public_quote'),
 ('v2_public_request_update'),
 ('v2_public_save'),
 ('v2_public_settings'),
 ('v2_public_submit'),
 ('v2_public_unread'),
 ('v2_purge_record'),
 ('v2_quick_setup'),
 ('v2_record_activity'),
 ('v2_record_metric'),
 ('v2_reservation_summary'),
 ('v2_restore_record'),
 ('v2_retention_defer'),
 ('v2_retention_delete'),
 ('v2_retention_due'),
 ('v2_retention_maintenance'),
 ('v2_session_alive'),
 ('v2_session_close'),
 ('v2_session_list'),
 ('v2_session_remember_device'),
 ('v2_session_revoke'),
 ('v2_session_touch_active'),
 ('v2_set_team_excel_exports'),
 ('v2_soft_delete'),
 ('v2_support_authorize'),
 ('v2_support_open'),
 ('v2_support_requests'),
 ('v2_support_resolve'),
 ('v2_support_revoke'),
 ('v2_take_rate_limit'),
 ('v2_transfer_owner'),
 ('v2_trash_page')
), expected_tables(name) AS (VALUES
 ('v2_account_email_changes'),
 ('v2_ai_requests'),
 ('v2_areas'),
 ('v2_audit_log'),
 ('v2_billing_events'),
 ('v2_billing_state'),
 ('v2_clients'),
 ('v2_email_security'),
 ('v2_employees'),
 ('v2_expiry_notices'),
 ('v2_legal_acceptances'),
 ('v2_lemon_checkouts'),
 ('v2_members'),
 ('v2_message_templates'),
 ('v2_payment_accounts'),
 ('v2_public_assets'),
 ('v2_public_pages'),
 ('v2_quote_items'),
 ('v2_quote_products'),
 ('v2_quotes'),
 ('v2_reservation_areas'),
 ('v2_reservations'),
 ('v2_restaurants'),
 ('v2_schedules'),
 ('v2_shifts'),
 ('v2_support_grants')
), app_tables AS (
 SELECT c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reltuples
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname LIKE 'v2\_%' ESCAPE '\'
 AND c.relkind IN ('r','p')
), app_functions AS (
 SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'v2\_%' ESCAPE '\'
 AND p.prokind='f'
)
SELECT jsonb_build_object(
 'format_version',1,
 'generated_at',now(),
 'database',jsonb_build_object(
   'server_version',current_setting('server_version'),
   'bytes',pg_database_size(current_database()),
   'max_connections',current_setting('max_connections'),
   'transaction_read_only',current_setting('transaction_read_only')
 ),
 'statistics', (SELECT jsonb_build_object('connections',numbackends,
   'commits_since_stats_reset',xact_commit,'rollbacks_since_stats_reset',xact_rollback,
   'deadlocks_since_stats_reset',deadlocks,'temporary_bytes_since_stats_reset',temp_bytes,
   'cache_hits_since_stats_reset',blks_hit,'disk_reads_since_stats_reset',blks_read,
   'stats_reset',stats_reset) FROM pg_stat_database WHERE datname=current_database()),
 'tables',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'name',t.relname,'rls_enabled',t.relrowsecurity,'rls_forced',t.relforcerowsecurity,
   'planner_rows_estimate',t.reltuples::bigint,'bytes',pg_total_relation_size(t.oid),
   'live_rows_estimate',s.n_live_tup,'dead_rows_estimate',s.n_dead_tup,
   'last_autoanalyze',s.last_autoanalyze,'last_autovacuum',s.last_autovacuum,
   'sequential_scans',s.seq_scan,'index_scans',s.idx_scan
 ) ORDER BY t.relname) FROM app_tables t LEFT JOIN pg_stat_user_tables s ON s.relid=t.oid),'[]'::jsonb),
 'missing_static_table_names',coalesce((SELECT jsonb_agg(e.name ORDER BY e.name)
   FROM expected_tables e WHERE NOT EXISTS(SELECT 1 FROM app_tables t WHERE t.relname=e.name)),'[]'::jsonb),
 'indexes',coalesce((SELECT jsonb_agg(jsonb_build_object('table',t.relname,
   'name',ic.relname,'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,
   'definition',pg_get_indexdef(i.indexrelid)) ORDER BY t.relname,ic.relname)
   FROM app_tables t JOIN pg_index i ON i.indrelid=t.oid JOIN pg_class ic ON ic.oid=i.indexrelid),'[]'::jsonb),
 'constraints',coalesce((SELECT jsonb_agg(jsonb_build_object('table',t.relname,
   'name',c.conname,'type',c.contype,'validated',c.convalidated,'definition',pg_get_constraintdef(c.oid))
   ORDER BY t.relname,c.conname) FROM app_tables t JOIN pg_constraint c ON c.conrelid=t.oid),'[]'::jsonb),
 'policies',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',schemaname,
   'table',tablename,'name',policyname,'roles',roles,'command',cmd,
   'permissive',permissive,'using',qual,'with_check',with_check)
   ORDER BY schemaname,tablename,policyname) FROM pg_policies
   WHERE (schemaname='public' AND tablename LIKE 'v2\_%' ESCAPE '\')
      OR (schemaname IN ('storage','realtime'))),'[]'::jsonb),
 'table_grants',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',table_schema,
   'table',table_name,'role',grantee,'privilege',privilege_type)
   ORDER BY table_schema,table_name,grantee,privilege_type) FROM information_schema.table_privileges
   WHERE table_schema='public' AND table_name LIKE 'v2\_%' ESCAPE '\'
   AND grantee IN ('anon','authenticated','PUBLIC')),'[]'::jsonb),
 'functions',coalesce((SELECT jsonb_agg(jsonb_build_object('name',p.proname,
   'arguments',pg_get_function_identity_arguments(p.oid),
   'security_definer',p.prosecdef,'volatility',p.provolatile,
   'configured_search_path',(SELECT value FROM unnest(p.proconfig) value WHERE value LIKE 'search_path=%' LIMIT 1),
   'definition_md5',md5(pg_get_functiondef(p.oid)),
   'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))
   ORDER BY p.proname,p.oid) FROM app_functions p),'[]'::jsonb),
 'missing_static_rpc_names',coalesce((SELECT jsonb_agg(e.name ORDER BY e.name)
   FROM expected_rpc e WHERE NOT EXISTS(SELECT 1 FROM app_functions p WHERE p.proname=e.name)),'[]'::jsonb),
 'limitations',jsonb_build_array(
   'Catalog snapshot only; not a load test or production security certification.',
   'Expected names come from static code calls; optional or dynamic calls need manual review.',
   'RLS enabled and grants present do not prove tenant isolation; test JWTs and privileged RPCs in staging.',
   'Security definer functions can be legitimate; inspect authorization and ownership before changing grants.',
   'This output omits business function bodies; their authorization still needs review.',
   'Plans, compute size, region, Realtime limits, backups, Storage files and Vercel usage need dashboard evidence.',
   'Review output before sharing: policy and index definitions are internal schema metadata.'
 )
) AS diagnostico;
ROLLBACK;
