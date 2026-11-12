export const APP_CAPABILITIES_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.app_capabilities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "publisherAppKey" character varying(64) NOT NULL,
    name character varying(128) NOT NULL,
    entity character varying(64) NOT NULL,
    fields text[] DEFAULT '{}'::text[] NOT NULL,
    permission character varying(128) NOT NULL,
    "ownerField" character varying(64),
    "readAllPermission" character varying(128),
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "createdById" uuid,
    CONSTRAINT "PK_app_capabilities" PRIMARY KEY (id),
    CONSTRAINT "FK_app_capabilities_organization"
      FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT "FK_app_capabilities_created_by"
      FOREIGN KEY ("createdById") REFERENCES public.users(id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_capabilities_org_publisher_name"
    ON public.app_capabilities USING btree ("organizationId", "publisherAppKey", name)`,
  `CREATE INDEX IF NOT EXISTS "idx_app_capabilities_org_publisher_status"
    ON public.app_capabilities USING btree ("organizationId", "publisherAppKey", status)`,
]
