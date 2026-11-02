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
  `CREATE TABLE IF NOT EXISTS public.agent_feedback_topics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "topicKey" character varying(128) NOT NULL,
    title text NOT NULL,
    severity character varying(32) NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(32) DEFAULT 'open' NOT NULL,
    "linkedProposalId" uuid,
    CONSTRAINT "PK_agent_feedback_topics" PRIMARY KEY (id),
    CONSTRAINT "CK_agent_feedback_topics_severity" CHECK (severity IN ('low','medium','high')),
    CONSTRAINT "CK_agent_feedback_topics_status" CHECK (status IN ('open','proposed','resolved','dismissed'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_agent_feedback_org_status"
    ON public.agent_feedback ("organizationId", "appKey", status, "createdAt" DESC)`,
]
