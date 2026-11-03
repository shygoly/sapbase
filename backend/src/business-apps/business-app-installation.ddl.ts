/**
 * DDL 只有一份：migration、schema baseline、e2e 都消费这里。
 */
export const BUSINESS_APP_INSTALLATIONS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.app_installations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "displayName" character varying(255) NOT NULL,
    slug character varying(64) NOT NULL,
    "blueprintId" character varying(64) NOT NULL,
    "blueprintVersion" character varying(32) NOT NULL,
    "releaseDigest" character varying(71) NOT NULL,
    "runtimeRequirement" character varying(128) NOT NULL,
    "deploymentProfile" character varying(32) DEFAULT 'shared-saas'::character varying NOT NULL,
    status character varying(32) DEFAULT 'installing'::character varying NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    license jsonb,
    "currentRevisionId" uuid,
    "createdById" uuid,
    CONSTRAINT "PK_business_app_installations" PRIMARY KEY (id),
    CONSTRAINT "FK_business_app_installations_organization"
      FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT "FK_business_app_installations_created_by"
      FOREIGN KEY ("createdById") REFERENCES public.users(id)
  )`,
  `ALTER TABLE public.app_installations
    ADD COLUMN IF NOT EXISTS "currentRevisionId" uuid`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_installations_organization_app_key"
    ON public.app_installations USING btree ("organizationId", "appKey")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_installations_organization_slug"
    ON public.app_installations USING btree ("organizationId", slug)`,
  `CREATE INDEX IF NOT EXISTS "idx_app_installations_organization_status"
    ON public.app_installations USING btree ("organizationId", status)`,
  `CREATE INDEX IF NOT EXISTS "idx_app_installations_blueprint"
    ON public.app_installations USING btree ("blueprintId", "blueprintVersion")`,
  `CREATE TABLE IF NOT EXISTS public.app_installation_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appInstallationId" uuid NOT NULL,
    "previousRevisionId" uuid,
    "packageId" character varying(128) NOT NULL,
    "blueprintId" character varying(64) NOT NULL,
    "blueprintVersion" character varying(32) NOT NULL,
    "releaseDigest" character varying(71) NOT NULL,
    "runtimeRequirement" character varying(128) NOT NULL,
    action character varying(32) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    license jsonb,
    "createdById" uuid,
    CONSTRAINT "PK_business_app_installation_revisions" PRIMARY KEY (id),
    CONSTRAINT "FK_business_app_installation_revisions_organization"
      FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT "FK_business_app_installation_revisions_installation"
      FOREIGN KEY ("appInstallationId") REFERENCES public.app_installations(id) ON DELETE CASCADE,
    CONSTRAINT "FK_business_app_installation_revisions_created_by"
      FOREIGN KEY ("createdById") REFERENCES public.users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_app_installation_revisions_installation_created"
    ON public.app_installation_revisions USING btree ("appInstallationId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "idx_app_installation_revisions_organization"
    ON public.app_installation_revisions USING btree ("organizationId")`,
  `INSERT INTO public.app_installation_revisions (
    id, "createdAt", "updatedAt", "organizationId", "appInstallationId",
    "previousRevisionId", "packageId", "blueprintId", "blueprintVersion",
    "releaseDigest", "runtimeRequirement", action, config, license, "createdById"
  )
  SELECT
    public.uuid_generate_v4(), ai."createdAt", ai."updatedAt", ai."organizationId", ai.id,
    NULL, ai."blueprintId" || '-' || ai."blueprintVersion", ai."blueprintId", ai."blueprintVersion",
    ai."releaseDigest", ai."runtimeRequirement", 'installed', ai.config, ai.license, ai."createdById"
  FROM public.app_installations ai
  WHERE ai."currentRevisionId" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.app_installation_revisions r
      WHERE r."appInstallationId" = ai.id
    )`,
  `UPDATE public.app_installations ai
  SET "currentRevisionId" = r.id
  FROM public.app_installation_revisions r
  WHERE ai.id = r."appInstallationId"
    AND ai."currentRevisionId" IS NULL
    AND r.action = 'installed'`,
]
