/**
 * `blueprint_records` 的**唯一** DDL。
 *
 * 三处消费同一份，避免「迁移 / 基线 / e2e 各写一份」漂成三套 schema：
 *   1. 增量迁移 `1790900000000-CreateBlueprintRecords`
 *   2. 空库基线 `SCHEMA_BASELINE_SQL`（追加在末尾，此时 organizations 已存在）
 *   3. e2e `beforeAll` 幂等应用（本地 sapbasic 不靠人工 DDL）
 *
 * IF NOT EXISTS / DO 块让同一常量既能建空库也能补存量库。
 * 外键名用 TypeORM 对 TenantAwareEntity.organization 生成的哈希
 * （`FK_5aa919422d67fd4edb69df79958`），否则 verify-from-zero 会报约束待改名。
 */
export const BLUEPRINT_RECORDS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.blueprint_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "blueprintId" character varying NOT NULL,
    "blueprintVersion" character varying NOT NULL,
    entity character varying NOT NULL,
    data jsonb NOT NULL,
    CONSTRAINT "PK_blueprint_records" PRIMARY KEY (id)
)`,
  `CREATE INDEX IF NOT EXISTS idx_blueprint_records_blueprint_entity_org
    ON public.blueprint_records USING btree ("blueprintId", entity, "organizationId")`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_5aa919422d67fd4edb69df79958'
    ) THEN
      ALTER TABLE ONLY public.blueprint_records
        ADD CONSTRAINT "FK_5aa919422d67fd4edb69df79958"
        FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);
    END IF;
  END $$`,
]
