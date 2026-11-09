/** 复核/审批扩展 DDL；迁移 179400 消费。 */
export const REVIEW_APPROVAL_DDL: string[] = [
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS round integer DEFAULT 1 NOT NULL`,
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS kind character varying(16) DEFAULT 'human' NOT NULL`,
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS selector jsonb`,
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS assignee jsonb`,
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS "checkProvider" character varying(128)`,
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS "checkResult" jsonb`,
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS comment text`,
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS "decidedBy" uuid`,
  `ALTER TABLE public.blueprint_approvals ADD COLUMN IF NOT EXISTS "dueAt" timestamp with time zone`,
  `UPDATE public.blueprint_approvals SET round = 1 WHERE round IS NULL`,
  `UPDATE public.blueprint_approvals SET kind = 'human' WHERE kind IS NULL`,
  `ALTER TABLE public.blueprint_approvals DROP CONSTRAINT IF EXISTS "UQ_2d647c4c3aba8401909305918b1"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_blueprint_approval_record_rule_round_step"
     ON public.blueprint_approvals ("recordId", "ruleId", round, "stepIndex")`,
  `CREATE INDEX IF NOT EXISTS idx_blueprint_approval_org_status_due
     ON public.blueprint_approvals ("organizationId", status, "dueAt")`,

  `CREATE TABLE IF NOT EXISTS public.review_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "approvalId" uuid NOT NULL,
    "recordId" uuid NOT NULL,
    "authorId" uuid,
    body text NOT NULL,
    "parentId" uuid,
    attachments jsonb,
    visibility character varying(16) DEFAULT 'all'::character varying NOT NULL,
    CONSTRAINT "PK_review_comments" PRIMARY KEY (id),
    CONSTRAINT "FK_review_comment_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_review_comment_approval
     ON public.review_comments USING btree ("approvalId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS public.review_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "approvalId" uuid NOT NULL,
    "recordId" uuid NOT NULL,
    type character varying(32) NOT NULL,
    "actorId" uuid,
    payload jsonb,
    CONSTRAINT "PK_review_events" PRIMARY KEY (id),
    CONSTRAINT "FK_review_event_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_review_event_approval
     ON public.review_events USING btree ("approvalId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS public.review_delegations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "approvalId" uuid NOT NULL,
    "fromUserId" uuid NOT NULL,
    "toUserId" uuid NOT NULL,
    reason character varying(512),
    "validFrom" timestamp with time zone,
    "validTo" timestamp with time zone,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT "PK_review_delegations" PRIMARY KEY (id),
    CONSTRAINT "FK_review_delegation_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_review_delegation_approval
     ON public.review_delegations USING btree ("approvalId", status)`,

  `CREATE TABLE IF NOT EXISTS public.work_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "sourceType" character varying(32) NOT NULL,
    "sourceId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    status character varying(32) DEFAULT 'open'::character varying NOT NULL,
    "assigneeId" uuid,
    priority character varying(16) DEFAULT 'normal'::character varying NOT NULL,
    "dueAt" timestamp with time zone,
    metadata jsonb,
    CONSTRAINT "PK_work_items" PRIMARY KEY (id),
    CONSTRAINT "UQ_work_item_org_source" UNIQUE ("organizationId", "sourceType", "sourceId"),
    CONSTRAINT "FK_work_item_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_work_item_org_status_priority
     ON public.work_items USING btree ("organizationId", status, priority, "dueAt")`,
]
