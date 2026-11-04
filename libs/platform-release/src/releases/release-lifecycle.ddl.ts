export const RELEASE_LIFECYCLE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.app_drafts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "baseReleaseId" uuid,
    status character varying(32) DEFAULT 'draft' NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdBy" uuid,
    CONSTRAINT "PK_app_drafts" PRIMARY KEY (id),
    CONSTRAINT "CK_app_drafts_status" CHECK (status IN ('draft','frozen','archived')),
    CONSTRAINT "UQ_app_drafts_org_app_revision" UNIQUE ("organizationId", "appKey", revision)
  )`,
  `CREATE TABLE IF NOT EXISTS public.app_change_proposals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appKey" character varying(64) NOT NULL,
    "draftId" uuid NOT NULL,
    "baseReleaseId" uuid,
    type character varying(32) NOT NULL,
    areas text[] DEFAULT '{}'::text[] NOT NULL,
    status character varying(32) DEFAULT 'draft' NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    diff jsonb NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    risk jsonb DEFAULT '{}'::jsonb NOT NULL,
    "testPlan" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "rollbackPlan" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdByAgent" character varying(64),
    "createdBy" uuid,
    "approvedBy" uuid,
    "approvedAt" timestamp with time zone,
    "publishedReleaseId" uuid,
    CONSTRAINT "PK_app_change_proposals" PRIMARY KEY (id),
    CONSTRAINT "CK_app_proposals_type" CHECK (type IN ('copy','form','data','flow','rule','permission','agent','knowledge')),
    CONSTRAINT "CK_app_proposals_status" CHECK (status IN ('draft','submitted','validating','validated','approved','published','rejected','withdrawn'))
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_app_proposals_app_status"
    ON public.app_change_proposals ("organizationId", "appKey", status, "createdAt" DESC)`,
  `CREATE TABLE IF NOT EXISTS public.app_releases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid,
    "appKey" character varying(64) NOT NULL,
    version character varying(32) NOT NULL,
    channel character varying(32) NOT NULL,
    status character varying(32) DEFAULT 'building' NOT NULL,
    "baseReleaseId" uuid,
    manifest jsonb NOT NULL,
    changelog jsonb NOT NULL,
    compatibility jsonb DEFAULT '{}'::jsonb NOT NULL,
    digest character varying(80) NOT NULL,
    signature text NOT NULL,
    "publishedAt" timestamp with time zone,
    "publishedBy" uuid,
    "createdBy" uuid,
    CONSTRAINT "PK_app_releases" PRIMARY KEY (id),
    CONSTRAINT "CK_app_releases_channel" CHECK (channel IN ('preview','canary','stable')),
    CONSTRAINT "CK_app_releases_status" CHECK (status IN ('building','published','superseded','revoked','failed'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_app_releases_platform"
    ON public.app_releases ("appKey", version) WHERE "organizationId" IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_app_releases_tenant"
    ON public.app_releases ("organizationId", "appKey", version) WHERE "organizationId" IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS public.app_release_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "releaseId" uuid NOT NULL,
    "itemType" character varying(32) NOT NULL,
    "itemKey" text NOT NULL,
    "changeType" character varying(16) NOT NULL,
    "beforeDigest" text,
    "afterDigest" text,
    payload jsonb,
    CONSTRAINT "PK_app_release_items" PRIMARY KEY (id),
    CONSTRAINT "CK_app_release_items_change" CHECK ("changeType" IN ('added','changed','removed','deprecated')),
    CONSTRAINT "UQ_app_release_items" UNIQUE ("releaseId", "itemType", "itemKey")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_app_release_items_release"
    ON public.app_release_items ("releaseId", "itemType")`,
  `CREATE TABLE IF NOT EXISTS public.app_release_activations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appInstallationId" uuid NOT NULL,
    "releaseId" uuid NOT NULL,
    action character varying(16) NOT NULL,
    status character varying(32) DEFAULT 'scheduled' NOT NULL,
    cohort jsonb,
    "effectiveAt" timestamp with time zone DEFAULT now() NOT NULL,
    "activatedAt" timestamp with time zone,
    "activatedBy" uuid,
    reason text,
    "fromReleaseId" uuid,
    CONSTRAINT "PK_app_release_activations" PRIMARY KEY (id),
    CONSTRAINT "CK_app_release_activations_action" CHECK (action IN ('activate','upgrade','rollback')),
    CONSTRAINT "CK_app_release_activations_status" CHECK (status IN ('scheduled','active','superseded','rolled_back','cancelled'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_app_activation_single_active"
    ON public.app_release_activations ("appInstallationId") WHERE status = 'active' AND cohort IS NULL`,
  `CREATE TABLE IF NOT EXISTS public.app_release_approvals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "proposalId" uuid,
    "releaseId" uuid,
    "approverId" uuid NOT NULL,
    role character varying(32) NOT NULL,
    decision character varying(16) NOT NULL,
    comment text,
    CONSTRAINT "PK_app_release_approvals" PRIMARY KEY (id),
    CONSTRAINT "CK_app_release_approvals_role" CHECK (role IN ('owner','tech_lead','security','platform_admin')),
    CONSTRAINT "CK_app_release_approvals_decision" CHECK (decision IN ('approved','rejected'))
  )`,
  `CREATE TABLE IF NOT EXISTS public.app_release_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "releaseId" uuid NOT NULL,
    "organizationId" uuid,
    event character varying(64) NOT NULL,
    "actorId" uuid,
    "actorAgent" character varying(64),
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT "PK_app_release_events" PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS public.app_user_release_views (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "appInstallationId" uuid NOT NULL,
    "lastSeenReleaseId" uuid NOT NULL,
    "firstSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
    "lastSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_app_user_release_views" PRIMARY KEY (id),
    CONSTRAINT "UQ_app_user_release_views" UNIQUE ("userId", "appInstallationId")
  )`,
  `CREATE OR REPLACE FUNCTION app_release_guard() RETURNS trigger AS $$
  BEGIN
    IF old.status = 'published' THEN
      IF new.status NOT IN ('published','superseded','revoked') THEN
        RAISE EXCEPTION 'published release status cannot change to %', new.status;
      END IF;
      IF new.manifest IS DISTINCT FROM old.manifest
         OR new.changelog IS DISTINCT FROM old.changelog
         OR new.digest IS DISTINCT FROM old.digest
         OR new.version IS DISTINCT FROM old.version
         OR new."appKey" IS DISTINCT FROM old."appKey" THEN
        RAISE EXCEPTION 'published release is immutable';
      END IF;
    END IF;
    RETURN new;
  END $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_app_release_guard ON public.app_releases`,
  `CREATE TRIGGER trg_app_release_guard BEFORE UPDATE ON public.app_releases
    FOR EACH ROW EXECUTE FUNCTION app_release_guard()`,
  `CREATE OR REPLACE FUNCTION app_release_no_delete() RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'release rows are append-only';
  END $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS trg_app_release_no_delete ON public.app_releases`,
  `CREATE TRIGGER trg_app_release_no_delete BEFORE DELETE ON public.app_releases
    FOR EACH ROW EXECUTE FUNCTION app_release_no_delete()`,
]
