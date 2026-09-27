/**
 * `agent_confirmation_tokens` 的**唯一** DDL。
 *
 * 三处消费同一份：
 *   1. 增量迁移 `1791500000000-CreateAgentConfirmationTokens`
 *   2. 空库基线 `SCHEMA_BASELINE_SQL`
 *   3. e2e `beforeAll` 幂等应用（`test/agent-tools.e2e-spec.ts`）
 *
 * 外键 / 主键名用 TypeORM DefaultNamingStrategy 哈希
 * （`new DefaultNamingStrategy().primaryKeyName / foreignKeyName`）。
 */
export const AGENT_CONFIRMATION_TOKENS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.agent_confirmation_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    tool character varying NOT NULL,
    "argsDigest" character varying(64) NOT NULL,
    actor character varying NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "consumedAt" timestamp with time zone,
    CONSTRAINT "PK_18058f62de5de5627e22ebe699d" PRIMARY KEY (id)
  )`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_14bd7faa76804af32abe4aed6f0'
    ) THEN
      ALTER TABLE ONLY public.agent_confirmation_tokens
        ADD CONSTRAINT "FK_14bd7faa76804af32abe4aed6f0"
        FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);
    END IF;
  END $$`,
]
