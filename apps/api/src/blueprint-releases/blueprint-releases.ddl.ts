export const BLUEPRINT_RELEASES_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.blueprint_releases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "blueprintId" character varying(64) NOT NULL,
    version character varying(32) NOT NULL,
    "packageId" character varying(128) NOT NULL,
    "releaseDigest" character varying(71) NOT NULL,
    "runtimeRequirement" character varying(128) NOT NULL,
    "trustStatus" character varying(32) DEFAULT 'verified'::character varying NOT NULL,
    layers jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb,
    "createdById" uuid,
    CONSTRAINT "PK_blueprint_releases" PRIMARY KEY (id),
    CONSTRAINT "UQ_blueprint_releases_org_blueprint_version"
      UNIQUE ("organizationId", "blueprintId", version),
    CONSTRAINT "FK_blueprint_releases_organization"
      FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT "FK_blueprint_releases_created_by"
      FOREIGN KEY ("createdById") REFERENCES public.users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_blueprint_releases_org_blueprint
    ON public.blueprint_releases USING btree ("organizationId", "blueprintId", "createdAt" DESC)`,
  `ALTER TABLE public.app_installations
    ADD COLUMN IF NOT EXISTS "releaseId" uuid`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_app_installations_blueprint_release'
    ) THEN
      ALTER TABLE public.app_installations
        ADD CONSTRAINT "FK_app_installations_blueprint_release"
        FOREIGN KEY ("releaseId") REFERENCES public.blueprint_releases(id);
    END IF;
  END $$`,
  `CREATE INDEX IF NOT EXISTS idx_app_installations_release
    ON public.app_installations USING btree ("releaseId")`,
]
