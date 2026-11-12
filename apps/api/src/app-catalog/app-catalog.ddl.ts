/**
 * 应用级目录 DDL 单一来源（3.3）。
 * 消费方：迁移、schema manifest、DOMAIN.md、测试。
 */
export const APP_CATALOG_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.app_role_bindings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    permissions text DEFAULT '' NOT NULL,
    source character varying(16) DEFAULT 'manual'::character varying NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    "createdById" uuid,
    CONSTRAINT "PK_app_role_bindings" PRIMARY KEY (id),
    CONSTRAINT "FK_app_role_bindings_organization"
      FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT "FK_app_role_bindings_created_by"
      FOREIGN KEY ("createdById") REFERENCES public.users(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_role_bindings_org_app_name"
    ON public.app_role_bindings USING btree ("organizationId", "appKey", name)`,
  `CREATE INDEX IF NOT EXISTS "idx_app_role_bindings_org_app_status"
    ON public.app_role_bindings USING btree ("organizationId", "appKey", status)`,
  `CREATE TABLE IF NOT EXISTS public.app_brand_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "logoUrl" character varying(500),
    "faviconUrl" character varying(500),
    theme jsonb,
    "customCss" text,
    "appName" character varying(255),
    "supportEmail" character varying(255),
    "supportUrl" character varying(500),
    CONSTRAINT "PK_app_brand_configs" PRIMARY KEY (id),
    CONSTRAINT "FK_app_brand_configs_organization"
      FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_brand_configs_org_app"
    ON public.app_brand_configs USING btree ("organizationId", "appKey")`,
  `CREATE INDEX IF NOT EXISTS "idx_app_brand_configs_org_app"
    ON public.app_brand_configs USING btree ("organizationId", "appKey")`,
]
