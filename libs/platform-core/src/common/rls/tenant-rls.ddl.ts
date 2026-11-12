const DIRECT_TABLES = [
  'departments',
  'roles',
  'audit_logs',
  'audit_checkpoints',
  'audit_archives',
  'review_comments',
  'review_events',
  'review_delegations',
  'work_items',
  'settings',
  'permissions',
  'menu_items',
  'ai_modules',
  'module_registry',
  'brand_configs',
  'invitations',
  'organization_activities',
  'blueprint_records',
  'blueprint_approvals',
  'blueprint_doc_counters',
  'blueprint_journal_entries',
  'blueprint_suggestion_logs',
  'outbox_events',
  'notifications',
  'notification_preferences',
  'announcements',
  'announcement_audiences',
  'announcement_deliveries',
  'agent_confirmation_tokens',
  'app_installations',
  'app_installation_revisions',
  'workflow_definitions',
  'workflow_instances',
  'workflow_auto_suggestion_logs',
  'plugins',
  'scope_dimensions',
  'scope_nodes',
  'scope_memberships',
  'scope_bindings',
  'data_policies',
  'scope_versions',
  'jobs',
  'organization_member_roles',
  'auth_sessions',
  'identity_providers',
  'identity_links',
  'auth_login_events',
  'identity_sync_runs',
  'service_clients',
  'assets',
  'search_documents',
  'record_snapshots',
  'record_operations',
  'ai_content_provenance',
  'ai_content_labels',
  'ai_score_records',
  'metric_definitions',
  'metric_values',
  'dashboards',
  'dashboard_widgets',
  'metric_alerts',
  'metric_alert_events',
  'offline_packages',
  'offline_entitlements',
  'offline_devices',
  'document_parse_runs',
  'document_sections',
  'document_candidates',
  'import_runs',
  'export_runs',
  'import_mappings',
  'integration_connectors',
  'outbound_messages',
  'webhook_endpoints',
  'webhook_events',
  'data_sources',
  'data_sync_jobs',
  'data_sync_runs',
  'asset_variants',
  'asset_upload_sessions',
] as const

const CHILD_TABLES = [
  {
    table: 'ai_module_definitions',
    column: 'aiModuleId',
    parent: 'ai_modules',
  },
  { table: 'ai_module_reviews', column: 'moduleId', parent: 'ai_modules' },
  { table: 'ai_module_tests', column: 'moduleId', parent: 'ai_modules' },
  {
    table: 'module_capabilities',
    column: 'moduleId',
    parent: 'module_registry',
  },
  {
    table: 'module_configurations',
    column: 'moduleId',
    parent: 'module_registry',
  },
  {
    table: 'module_relationships',
    column: 'sourceModuleId',
    parent: 'module_registry',
  },
  {
    table: 'module_statistics',
    column: 'moduleId',
    parent: 'module_registry',
  },
  {
    table: 'workflow_history',
    column: 'workflowInstanceId',
    parent: 'workflow_instances',
  },
  {
    table: 'outbox_deliveries',
    column: 'eventId',
    parent: 'outbox_events',
  },
  {
    table: 'job_attempts',
    column: 'jobId',
    parent: 'jobs',
  },
  {
    table: 'job_events',
    column: 'jobId',
    parent: 'jobs',
  },
] as const

/**
 * Tenant RLS uses transaction-local settings:
 *   app.organization_id
 *   app.app_installation_id
 *   app.user_id
 *
 * Policies are enabled but not forced so migration/test owners remain able to
 * administer the database. Production must use a non-owner application role;
 * RlsPolicyService fails startup when RLS_ENFORCEMENT=required and that
 * separation is missing.
 */
export const TENANT_RLS_DDL: string[] = [
  `CREATE OR REPLACE FUNCTION public.current_organization_id()
   RETURNS uuid LANGUAGE sql STABLE AS $$
     SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
   $$`,
  `CREATE OR REPLACE FUNCTION public.current_app_installation_id()
   RETURNS uuid LANGUAGE sql STABLE AS $$
     SELECT NULLIF(current_setting('app.app_installation_id', true), '')::uuid
   $$`,
  `CREATE OR REPLACE FUNCTION public.current_user_id()
   RETURNS uuid LANGUAGE sql STABLE AS $$
     SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
   $$`,
  ...DIRECT_TABLES.map(
    (table) => `DO $$ BEGIN
      IF to_regclass('public.${table}') IS NOT NULL THEN
        ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON public.${table};
        CREATE POLICY tenant_isolation ON public.${table}
          USING ("organizationId"::text = public.current_organization_id()::text)
          WITH CHECK ("organizationId"::text = public.current_organization_id()::text);
      END IF;
    END $$`,
  ),
  ...CHILD_TABLES.map(
    ({ table, column, parent }) => `DO $$ BEGIN
      IF to_regclass('public.${table}') IS NOT NULL
         AND to_regclass('public.${parent}') IS NOT NULL THEN
        ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_parent_isolation ON public.${table};
        CREATE POLICY tenant_parent_isolation ON public.${table}
          USING (EXISTS (
            SELECT 1 FROM public.${parent} p
            WHERE p.id::text = "${column}"::text
          ))
          WITH CHECK (EXISTS (
            SELECT 1 FROM public.${parent} p
            WHERE p.id::text = "${column}"::text
          ));
      END IF;
    END $$`,
  ),
  `DO $$ BEGIN
    IF to_regclass('public.atomic_contracts') IS NOT NULL THEN
      ALTER TABLE public.atomic_contracts ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS atomic_contracts_read ON public.atomic_contracts;
      CREATE POLICY atomic_contracts_read ON public.atomic_contracts
        FOR SELECT
        USING (
          "organizationId" IS NULL
          OR "organizationId"::text = public.current_organization_id()::text
        );
      DROP POLICY IF EXISTS atomic_contracts_write ON public.atomic_contracts;
      CREATE POLICY atomic_contracts_write ON public.atomic_contracts
        FOR ALL
        USING ("organizationId"::text = public.current_organization_id()::text)
        WITH CHECK ("organizationId"::text = public.current_organization_id()::text);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF to_regclass('public.atomic_implementations') IS NOT NULL
       AND to_regclass('public.atomic_contracts') IS NOT NULL THEN
      ALTER TABLE public.atomic_implementations ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS atomic_implementations_parent ON public.atomic_implementations;
      CREATE POLICY atomic_implementations_parent ON public.atomic_implementations
        USING (EXISTS (
          SELECT 1 FROM public.atomic_contracts c
          WHERE c.id::text = public.atomic_implementations."atomicContractId"::text
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.atomic_contracts c
          WHERE c.id::text = public.atomic_implementations."atomicContractId"::text
        ));
    END IF;
  END $$`,
]

export const TENANT_RLS_TABLE_COUNT = DIRECT_TABLES.length + CHILD_TABLES.length + 2
