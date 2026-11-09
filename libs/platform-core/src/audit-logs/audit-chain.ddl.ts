/** 审计链扩展 DDL；迁移 179390 消费。 */
export const AUDIT_CHAIN_DDL: string[] = [
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS seq bigint`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "prevHash" character varying(128)`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS hash character varying(128)`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "hashAlgo" character varying(32) DEFAULT 'sha256'`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS payload jsonb`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "actorType" character varying(32) DEFAULT 'user'`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "appInstallationId" uuid`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip character varying(64)`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "userAgent" character varying(512)`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "correlationId" character varying(128)`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS source character varying(64)`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "retentionUntil" timestamp with time zone`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "legalHold" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS "archivedAt" timestamp with time zone`,
  `UPDATE public.audit_logs SET hash = 'legacy', "hashAlgo" = 'sha256' WHERE hash IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_audit_log_org_seq"
     ON public.audit_logs ("organizationId", seq) WHERE seq IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_org_seq
     ON public.audit_logs ("organizationId", seq)`,

  `CREATE OR REPLACE FUNCTION public.prevent_audit_mutation() RETURNS trigger
   LANGUAGE plpgsql AS $$
   BEGIN
     IF current_setting('app.audit_break_glass', true) = 'on' THEN
       RETURN OLD;
     END IF;
     RAISE EXCEPTION 'audit_logs is append-only (set app.audit_break_glass=on for break-glass)';
   END;
   $$`,
  `DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs`,
  `CREATE TRIGGER trg_audit_logs_append_only
     BEFORE UPDATE OR DELETE ON public.audit_logs
     FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation()`,

  `CREATE TABLE IF NOT EXISTS public.audit_checkpoints (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    seq bigint NOT NULL,
    hash character varying(128) NOT NULL,
    signature character varying(512),
    signer character varying(128),
    metadata jsonb,
    CONSTRAINT "PK_audit_checkpoints" PRIMARY KEY (id),
    CONSTRAINT "UQ_audit_checkpoint_org_seq" UNIQUE ("organizationId", seq),
    CONSTRAINT "FK_audit_checkpoint_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE TABLE IF NOT EXISTS public.audit_archives (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "fromSeq" bigint NOT NULL,
    "toSeq" bigint NOT NULL,
    "objectKey" character varying(512),
    manifest jsonb,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    CONSTRAINT "PK_audit_archives" PRIMARY KEY (id),
    CONSTRAINT "FK_audit_archive_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
]
