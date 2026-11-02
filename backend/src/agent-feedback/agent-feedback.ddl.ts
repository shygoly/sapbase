export const AGENT_FEEDBACK_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.agent_feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "releaseId" uuid,
    cohort jsonb,
    "userId" uuid NOT NULL,
    role character varying(64),
    screen jsonb,
    "traceId" character varying(64),
    "toolCallIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
    category character varying(64) NOT NULL,
    "contentMasked" text,
    status character varying(32) DEFAULT 'new' NOT NULL,
    CONSTRAINT "PK_agent_feedback" PRIMARY KEY (id),
    CONSTRAINT "CK_agent_feedback_status" CHECK (status IN ('new','triaged','proposed','resolved','dismissed'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_agent_feedback_org_status"
    ON public.agent_feedback ("organizationId", "appKey", status, "createdAt" DESC)`,
]
