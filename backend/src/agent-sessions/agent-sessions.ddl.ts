export const AGENT_SESSIONS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.agent_conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "appInstallationId" uuid,
    "userId" uuid NOT NULL,
    "releaseId" uuid,
    "lastTurnAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_agent_conversations" PRIMARY KEY (id)
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_agent_conversations_user"
    ON public.agent_conversations ("organizationId", "userId", "lastTurnAt" DESC)`,
  `CREATE TABLE IF NOT EXISTS public.agent_turns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "conversationId" uuid NOT NULL,
    "releaseId" uuid,
    "modelId" character varying(64),
    "promptHash" character varying(64),
    "contextHash" character varying(64),
    "tokensIn" integer DEFAULT 0 NOT NULL,
    "tokensOut" integer DEFAULT 0 NOT NULL,
    "latencyMs" integer DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'running' NOT NULL,
    CONSTRAINT "PK_agent_turns" PRIMARY KEY (id),
    CONSTRAINT "CK_agent_turns_status" CHECK (status IN ('running','completed','cancelled','failed'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_agent_turns_conversation"
    ON public.agent_turns ("conversationId", "createdAt" DESC)`,
  `CREATE TABLE IF NOT EXISTS public.agent_tool_calls (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "turnId" uuid NOT NULL,
    tool character varying(64) NOT NULL,
    "argsDigest" character varying(64),
    "permissionOk" boolean DEFAULT false NOT NULL,
    "confirmationId" uuid,
    status character varying(32) NOT NULL,
    "errorCode" character varying(32),
    "latencyMs" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "PK_agent_tool_calls" PRIMARY KEY (id),
    CONSTRAINT "CK_agent_tool_calls_status" CHECK (status IN ('success','failure'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_agent_tool_calls_turn"
    ON public.agent_tool_calls ("turnId")`,
]
