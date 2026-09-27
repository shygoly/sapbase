/**
 * `notifications` 的**唯一** DDL。
 *
 * 三处消费同一份：
 *   1. 增量迁移 `1791300000000-CreateNotifications`
 *   2. 空库基线 `SCHEMA_BASELINE_SQL`
 *   3. e2e `beforeAll` 幂等应用
 *
 * 外键 / 主键 / 唯一 / 索引名用 TypeORM DefaultNamingStrategy 哈希。
 */
export const NOTIFICATIONS_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    type character varying NOT NULL,
    title character varying NOT NULL,
    body text,
    read boolean DEFAULT false NOT NULL,
    "sourceEventId" uuid,
    metadata jsonb,
    CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id),
    CONSTRAINT "UQ_479a637eaa18f30ade2757e6afa" UNIQUE ("sourceEventId", "userId")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_b055cfdba5009facbb972837dd"
    ON public.notifications USING btree ("userId", read, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "IDX_d4ab04c0b8e2d7435ec2357cce"
    ON public.notifications USING btree ("organizationId", "createdAt")`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'UQ_479a637eaa18f30ade2757e6afa'
    ) THEN
      ALTER TABLE ONLY public.notifications
        ADD CONSTRAINT "UQ_479a637eaa18f30ade2757e6afa" UNIQUE ("sourceEventId", "userId");
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_928914a0743f50e6f83a90cdda9'
    ) THEN
      ALTER TABLE ONLY public.notifications
        ADD CONSTRAINT "FK_928914a0743f50e6f83a90cdda9"
        FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);
    END IF;
  END $$`,
]
