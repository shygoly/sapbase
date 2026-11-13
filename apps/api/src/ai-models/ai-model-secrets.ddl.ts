export const AI_MODEL_SECRETS_DDL: string[] = [
  `ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS "secretRef" character varying(255)`,
  `CREATE TABLE IF NOT EXISTS public.ai_model_calls (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid,
    "requestedModelId" character varying(64),
    "resolvedModelId" character varying(64) NOT NULL,
    provider character varying(50) NOT NULL,
    model character varying(100),
    "credentialSource" character varying(32) NOT NULL,
    status character varying(32) DEFAULT 'success'::character varying NOT NULL,
    "latencyMs" integer DEFAULT 0 NOT NULL,
    error text,
    metadata jsonb,
    CONSTRAINT "PK_ai_model_calls" PRIMARY KEY (id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_model_calls_org_created
    ON public.ai_model_calls USING btree ("organizationId", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_model_calls_request
    ON public.ai_model_calls USING btree ("requestedModelId", "createdAt" DESC)`,
]
