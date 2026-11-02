export const AGENT_EVAL_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.agent_eval_cases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    suite character varying(32) NOT NULL,
    "caseKey" character varying(128) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    input jsonb NOT NULL,
    expected jsonb NOT NULL,
    status character varying(32) DEFAULT 'active' NOT NULL,
    CONSTRAINT "PK_agent_eval_cases" PRIMARY KEY (id),
    CONSTRAINT "CK_agent_eval_cases_suite" CHECK (suite IN ('faq','navigate','query','write','refusal','injection','release')),
    CONSTRAINT "CK_agent_eval_cases_status" CHECK (status IN ('active','retired'))
  )`,
  `CREATE TABLE IF NOT EXISTS public.agent_eval_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid,
    "releaseId" uuid,
    "skillVersion" character varying(128),
    suite character varying(32) NOT NULL,
    passed integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    "startedAt" timestamp with time zone,
    "finishedAt" timestamp with time zone,
    CONSTRAINT "PK_agent_eval_runs" PRIMARY KEY (id)
  )`,
]
