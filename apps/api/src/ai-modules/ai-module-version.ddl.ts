export const AI_MODULE_VERSION_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.ai_module_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "moduleId" uuid NOT NULL,
    version character varying(50) NOT NULL,
    "patchContent" jsonb NOT NULL,
    metadata jsonb,
    definition jsonb,
    status character varying(50) NOT NULL,
    actor character varying(255) DEFAULT 'system'::character varying NOT NULL,
    reason character varying(255),
    CONSTRAINT "PK_ai_module_versions" PRIMARY KEY (id),
    CONSTRAINT "FK_ai_module_version_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_ai_module_version_module" FOREIGN KEY ("moduleId") REFERENCES public.ai_modules(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_module_version_org_module_created
     ON public.ai_module_versions USING btree ("organizationId", "moduleId", "createdAt")`,
]
