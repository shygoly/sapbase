/**
 * Data Scope DDL 单一来源。
 *
 * 消费方：
 *   1. 迁移 `1793100000000-CreateDataScope`
 *   2. 空库基线（后续由 generate-schema-baseline 吸收；本文件先作为增量真源）
 *   3. 测试可断言表/索引存在
 */
export const DATA_SCOPE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.scope_dimensions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    key character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    config jsonb,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT "PK_scope_dimensions" PRIMARY KEY (id),
    CONSTRAINT "UQ_scope_dimension_org_key" UNIQUE ("organizationId", key),
    CONSTRAINT "FK_scope_dimension_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scope_dimension_org_status
    ON public.scope_dimensions USING btree ("organizationId", status)`,

  `CREATE TABLE IF NOT EXISTS public.scope_nodes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "dimensionId" uuid NOT NULL,
    "parentId" uuid,
    path text NOT NULL,
    depth integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(128),
    metadata jsonb,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT "PK_scope_nodes" PRIMARY KEY (id),
    CONSTRAINT "UQ_scope_node_org_dimension_path" UNIQUE ("organizationId", "dimensionId", path),
    CONSTRAINT "FK_scope_node_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_scope_node_dimension" FOREIGN KEY ("dimensionId") REFERENCES public.scope_dimensions(id) ON DELETE CASCADE,
    CONSTRAINT "FK_scope_node_parent" FOREIGN KEY ("parentId") REFERENCES public.scope_nodes(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scope_node_org_dimension_path
    ON public.scope_nodes USING btree ("organizationId", "dimensionId", path)`,
  `CREATE INDEX IF NOT EXISTS idx_scope_node_org_dimension_parent
    ON public.scope_nodes USING btree ("organizationId", "dimensionId", "parentId")`,

  `CREATE TABLE IF NOT EXISTS public.scope_memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "subjectType" character varying(16) NOT NULL,
    "subjectId" character varying(255) NOT NULL,
    "nodeId" uuid NOT NULL,
    "positionKey" character varying(64) NOT NULL,
    "validFrom" timestamp with time zone,
    "validTo" timestamp with time zone,
    metadata jsonb,
    CONSTRAINT "PK_scope_memberships" PRIMARY KEY (id),
    CONSTRAINT "FK_scope_membership_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_scope_membership_node" FOREIGN KEY ("nodeId") REFERENCES public.scope_nodes(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scope_membership_org_subject
    ON public.scope_memberships USING btree ("organizationId", "subjectType", "subjectId")`,
  `CREATE INDEX IF NOT EXISTS idx_scope_membership_org_node
    ON public.scope_memberships USING btree ("organizationId", "nodeId", "positionKey")`,

  `CREATE TABLE IF NOT EXISTS public.scope_bindings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "resourceKey" character varying(255) NOT NULL,
    "dimensionKey" character varying(64) NOT NULL,
    kind character varying(16) NOT NULL,
    field character varying(128),
    relation jsonb,
    writable boolean DEFAULT true NOT NULL,
    CONSTRAINT "PK_scope_bindings" PRIMARY KEY (id),
    CONSTRAINT "UQ_scope_binding_org_resource_dimension_kind"
      UNIQUE ("organizationId", "resourceKey", "dimensionKey", kind),
    CONSTRAINT "FK_scope_binding_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scope_binding_org_resource_dimension_kind
    ON public.scope_bindings USING btree ("organizationId", "resourceKey", "dimensionKey", kind)`,

  `CREATE TABLE IF NOT EXISTS public.data_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    subject jsonb NOT NULL,
    "resourceKey" character varying(255) NOT NULL,
    actions jsonb NOT NULL,
    effect character varying(8) DEFAULT 'allow'::character varying NOT NULL,
    scope jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT "PK_data_policies" PRIMARY KEY (id),
    CONSTRAINT "FK_data_policy_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_data_policy_org_resource_status
    ON public.data_policies USING btree ("organizationId", "resourceKey", status)`,
  `CREATE INDEX IF NOT EXISTS idx_data_policy_org_effect
    ON public.data_policies USING btree ("organizationId", effect)`,

  `CREATE TABLE IF NOT EXISTS public.scope_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT "PK_scope_versions" PRIMARY KEY (id),
    CONSTRAINT "UQ_scope_version_org" UNIQUE ("organizationId"),
    CONSTRAINT "FK_scope_version_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
]
