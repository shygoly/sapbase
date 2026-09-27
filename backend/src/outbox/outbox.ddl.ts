/**
 * `outbox_events` / `outbox_deliveries` 的**唯一** DDL。
 *
 * 三处消费同一份：
 *   1. 增量迁移 `1791200000000-CreateOutbox`
 *   2. 空库基线 `SCHEMA_BASELINE_SQL`
 *   3. e2e `beforeAll` 幂等应用
 *
 * 外键 / 主键 / 唯一 / 索引名用 TypeORM DefaultNamingStrategy 哈希。
 */
export const OUTBOX_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.outbox_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    topic character varying NOT NULL,
    payload jsonb NOT NULL,
    "occurredAt" timestamp without time zone NOT NULL,
    "deliveredAt" timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL,
    "lastError" text,
    "idempotencyKey" character varying NOT NULL,
    status character varying NOT NULL,
    "nextAttemptAt" timestamp without time zone,
    "aggregateType" character varying,
    "aggregateId" character varying,
    CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY (id),
    CONSTRAINT "UQ_2664623806d6e3483057865b8b6" UNIQUE ("idempotencyKey")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_d2869b821d7b201618c9858ab6"
    ON public.outbox_events USING btree (status, "nextAttemptAt")`,
  `CREATE INDEX IF NOT EXISTS "IDX_d2d9822da80020878a360eaf40"
    ON public.outbox_events USING btree ("organizationId", "occurredAt")`,
  `CREATE INDEX IF NOT EXISTS "IDX_34d5a8c6d3ddf4e6375e11131c"
    ON public.outbox_events USING btree ("aggregateType", "aggregateId")`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'UQ_2664623806d6e3483057865b8b6'
    ) THEN
      ALTER TABLE ONLY public.outbox_events
        ADD CONSTRAINT "UQ_2664623806d6e3483057865b8b6" UNIQUE ("idempotencyKey");
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_7ef528beecf23e5e0134ef8884f'
    ) THEN
      ALTER TABLE ONLY public.outbox_events
        ADD CONSTRAINT "FK_7ef528beecf23e5e0134ef8884f"
        FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);
    END IF;
  END $$`,
  `CREATE TABLE IF NOT EXISTS public.outbox_deliveries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "eventId" uuid NOT NULL,
    subscriber text NOT NULL,
    CONSTRAINT "PK_553a2a80e9203a20e34f9771f34" PRIMARY KEY (id),
    CONSTRAINT "UQ_613903349ab26e7092581449581" UNIQUE ("eventId", subscriber)
  )`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'UQ_613903349ab26e7092581449581'
    ) THEN
      ALTER TABLE ONLY public.outbox_deliveries
        ADD CONSTRAINT "UQ_613903349ab26e7092581449581" UNIQUE ("eventId", subscriber);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_b24a7e1b4c667e72d9f7b5fc204'
    ) THEN
      ALTER TABLE ONLY public.outbox_deliveries
        ADD CONSTRAINT "FK_b24a7e1b4c667e72d9f7b5fc204"
        FOREIGN KEY ("eventId") REFERENCES public.outbox_events(id) ON DELETE CASCADE;
    END IF;
  END $$`,
]
