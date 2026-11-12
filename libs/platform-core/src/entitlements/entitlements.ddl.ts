/**
 * 订阅权益与用量计量 DDL 单一来源。
 * 消费方：迁移、schema manifest 对拍、DOMAIN.md、测试。
 */
export const ENTITLEMENTS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.app_entitlements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "planName" character varying(50) NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    source character varying(16) DEFAULT 'plan'::character varying NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    "validFrom" timestamp with time zone,
    "validTo" timestamp with time zone,
    "createdById" uuid,
    CONSTRAINT "PK_app_entitlements" PRIMARY KEY (id),
    CONSTRAINT "FK_app_entitlements_organization"
      FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT "FK_app_entitlements_created_by"
      FOREIGN KEY ("createdById") REFERENCES public.users(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_entitlements_organization_app_key"
    ON public.app_entitlements USING btree ("organizationId", "appKey")`,
  `CREATE INDEX IF NOT EXISTS "idx_app_entitlements_organization_status"
    ON public.app_entitlements USING btree ("organizationId", status)`,
  `CREATE TABLE IF NOT EXISTS public.app_usage_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    metric character varying(128) NOT NULL,
    quantity numeric(20,4) DEFAULT 0 NOT NULL,
    "periodStart" timestamp with time zone NOT NULL,
    "periodEnd" timestamp with time zone NOT NULL,
    source character varying(64) NOT NULL,
    "idempotencyKey" character varying(128),
    metadata jsonb,
    CONSTRAINT "PK_app_usage_records" PRIMARY KEY (id),
    CONSTRAINT "FK_app_usage_records_organization"
      FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_app_usage_records_org_app_metric_period"
    ON public.app_usage_records USING btree ("organizationId", "appKey", metric, "periodStart")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_usage_records_org_idempotency"
    ON public.app_usage_records USING btree ("organizationId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL`,
]
