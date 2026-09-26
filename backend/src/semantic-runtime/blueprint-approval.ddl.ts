/**
 * `blueprint_approvals` 的**唯一** DDL。
 *
 * 三处消费同一份：
 *   1. 增量迁移 `1791100000000-CreateBlueprintApprovals`
 *   2. 空库基线 `SCHEMA_BASELINE_SQL`
 *   3. e2e `beforeAll` 幂等应用
 *
 * 外键 / 主键 / 唯一约束名用 TypeORM DefaultNamingStrategy 哈希。
 */
export const BLUEPRINT_APPROVALS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.blueprint_approvals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "blueprintId" character varying NOT NULL,
    "blueprintVersion" character varying NOT NULL,
    entity character varying NOT NULL,
    "recordId" uuid NOT NULL,
    "ruleId" character varying NOT NULL,
    "stepIndex" integer NOT NULL,
    role character varying NOT NULL,
    status character varying NOT NULL,
    actor character varying,
    "decidedAt" timestamp without time zone,
    CONSTRAINT "PK_baacb6e4c79d82f88ebcc5807f7" PRIMARY KEY (id),
    CONSTRAINT "UQ_2d647c4c3aba8401909305918b1" UNIQUE ("recordId", "ruleId", "stepIndex")
)`,
  `CREATE INDEX IF NOT EXISTS "IDX_2d647c4c3aba8401909305918b"
    ON public.blueprint_approvals USING btree ("recordId", "ruleId", "stepIndex")`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'UQ_2d647c4c3aba8401909305918b1'
    ) THEN
      ALTER TABLE ONLY public.blueprint_approvals
        ADD CONSTRAINT "UQ_2d647c4c3aba8401909305918b1" UNIQUE ("recordId", "ruleId", "stepIndex");
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_072c93b172cbcc9c5c3fc539792'
    ) THEN
      ALTER TABLE ONLY public.blueprint_approvals
        ADD CONSTRAINT "FK_072c93b172cbcc9c5c3fc539792"
        FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);
    END IF;
  END $$`,
]
