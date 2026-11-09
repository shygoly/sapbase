export const RELEASE_TEST_EVIDENCE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.app_release_test_evidence (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "commitSha" character varying(64),
    "suiteSummary" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "jestOutputDigest" character varying(128) NOT NULL,
    "ranAt" timestamp with time zone NOT NULL,
    "ranBy" uuid,
    CONSTRAINT "PK_app_release_test_evidence" PRIMARY KEY (id)
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_app_release_test_evidence_lookup"
    ON public.app_release_test_evidence ("organizationId", "appKey", "ranAt" DESC)`,
]
