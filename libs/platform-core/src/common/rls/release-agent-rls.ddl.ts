const DIRECT_TABLES = [
  'app_drafts',
  'app_change_proposals',
  'app_release_activations',
  'app_user_release_views',
  'app_release_test_evidence',
  'release_automation_policies',
  'agent_conversations',
  'agent_turns',
  'agent_tool_calls',
  'agent_feedback',
  'agent_feedback_topics',
] as const

const NULLABLE_ORG_TABLES = [
  'app_releases',
  'app_release_events',
  'agent_knowledge_entries',
  'agent_skill_versions',
  'agent_eval_runs',
] as const

const CHILD_TABLES = [
  { table: 'app_release_items', column: 'releaseId', parent: 'app_releases' },
  { table: 'release_automation_runs', column: 'policyId', parent: 'release_automation_policies' },
] as const

export const RELEASE_AGENT_RLS_TABLES = [
  ...DIRECT_TABLES,
  ...NULLABLE_ORG_TABLES,
  ...CHILD_TABLES.map((item) => item.table),
  'app_release_approvals',
] as const

export const RELEASE_AGENT_RLS_DDL: string[] = [
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
  ...NULLABLE_ORG_TABLES.map(
    (table) => `DO $$ BEGIN
      IF to_regclass('public.${table}') IS NOT NULL THEN
        ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation_read ON public.${table};
        DROP POLICY IF EXISTS tenant_isolation_write ON public.${table};
        CREATE POLICY tenant_isolation_read ON public.${table}
          FOR SELECT
          USING (
            "organizationId" IS NULL
            OR "organizationId"::text = public.current_organization_id()::text
          );
        CREATE POLICY tenant_isolation_write ON public.${table}
          FOR ALL
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
    IF to_regclass('public.app_release_approvals') IS NOT NULL THEN
      ALTER TABLE public.app_release_approvals ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_parent_isolation ON public.app_release_approvals;
      CREATE POLICY tenant_parent_isolation ON public.app_release_approvals
        USING (
          EXISTS (SELECT 1 FROM public.app_change_proposals p WHERE p.id::text = "proposalId"::text)
          OR EXISTS (SELECT 1 FROM public.app_releases r WHERE r.id::text = "releaseId"::text)
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.app_change_proposals p WHERE p.id::text = "proposalId"::text)
          OR EXISTS (SELECT 1 FROM public.app_releases r WHERE r.id::text = "releaseId"::text)
        );
    END IF;
  END $$`,
]
