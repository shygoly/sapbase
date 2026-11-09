/** 资产 DDL 单一来源；迁移 179370 与测试共用。 */
export const ASSET_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.assets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appInstallationId" uuid,
    "ownerId" uuid,
    kind character varying(32) DEFAULT 'other'::character varying NOT NULL,
    status character varying(32) DEFAULT 'uploading'::character varying NOT NULL,
    "objectKey" character varying(512) NOT NULL,
    "originalName" character varying(255) NOT NULL,
    "mimeType" character varying(128) NOT NULL,
    size bigint NOT NULL,
    checksum character varying(128),
    width integer,
    height integer,
    "durationMs" integer,
    "pageCount" integer,
    metadata jsonb,
    "isPublic" boolean DEFAULT false NOT NULL,
    "retentionUntil" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "createdBy" uuid,
    CONSTRAINT "PK_assets" PRIMARY KEY (id),
    CONSTRAINT "UQ_asset_org_object_key" UNIQUE ("organizationId", "objectKey"),
    CONSTRAINT "FK_asset_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_asset_org_status_created
    ON public.assets USING btree ("organizationId", status, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_asset_org_checksum
    ON public.assets USING btree ("organizationId", checksum)`,

  `CREATE TABLE IF NOT EXISTS public.asset_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "assetId" uuid NOT NULL,
    kind character varying(32) NOT NULL,
    "objectKey" character varying(512) NOT NULL,
    "mimeType" character varying(128) NOT NULL,
    size bigint NOT NULL,
    width integer,
    height integer,
    metadata jsonb,
    CONSTRAINT "PK_asset_variants" PRIMARY KEY (id),
    CONSTRAINT "UQ_asset_variant_asset_kind" UNIQUE ("assetId", kind),
    CONSTRAINT "FK_asset_variant_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_asset_variant_asset" FOREIGN KEY ("assetId") REFERENCES public.assets(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_asset_variant_org_asset
    ON public.asset_variants USING btree ("organizationId", "assetId")`,

  `CREATE TABLE IF NOT EXISTS public.asset_upload_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "objectKey" character varying(512) NOT NULL,
    "originalName" character varying(255) NOT NULL,
    "mimeType" character varying(128) NOT NULL,
    "expectedSize" bigint NOT NULL,
    checksum character varying(128),
    status character varying(32) DEFAULT 'uploading'::character varying NOT NULL,
    parts jsonb,
    "expiresAt" timestamp with time zone NOT NULL,
    "completedAt" timestamp with time zone,
    CONSTRAINT "PK_asset_upload_sessions" PRIMARY KEY (id),
    CONSTRAINT "UQ_asset_upload_object_key" UNIQUE ("organizationId", "objectKey"),
    CONSTRAINT "FK_asset_upload_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_asset_upload_org_status
    ON public.asset_upload_sessions USING btree ("organizationId", status)`,
]
