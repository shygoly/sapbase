export const RECORD_LIFECYCLE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.record_snapshots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "blueprintId" character varying NOT NULL,
    entity character varying NOT NULL,
    "recordId" uuid NOT NULL,
    version integer NOT NULL,
    label character varying(64),
    data jsonb NOT NULL,
    state character varying,
    "createdBy" uuid,
    reason text,
    published boolean DEFAULT false NOT NULL,
    CONSTRAINT "PK_record_snapshots" PRIMARY KEY (id),
    CONSTRAINT "UQ_record_snapshot_record_version" UNIQUE ("recordId", version)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_record_snapshot_org_record
     ON public.record_snapshots ("organizationId", "recordId", version)`,
  `CREATE TABLE IF NOT EXISTS public.record_operations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "blueprintId" character varying NOT NULL,
    entity character varying NOT NULL,
    "recordId" uuid,
    type character varying(32) NOT NULL,
    "idempotencyKey" character varying(128),
    status character varying(16) DEFAULT 'succeeded' NOT NULL,
    before jsonb,
    after jsonb,
    "createdBy" character varying(255),
    error text,
    CONSTRAINT "PK_record_operations" PRIMARY KEY (id),
    CONSTRAINT "CK_record_operation_status" CHECK (status IN ('succeeded','failed'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_record_operation_org_idem"
     ON public.record_operations ("organizationId", "idempotencyKey")
     WHERE "idempotencyKey" IS NOT NULL`,
]
