/**
 * 通知保留期与软删除 DDL：迁移 179400 消费。
 * 保留期清理不物理删除通知/公告，只写 deletedAt；审计/合规引用仍可追溯。
 */
export const NOTIFICATION_RETENTION_DDL: string[] = [
  `ALTER TABLE public.notifications
     ADD COLUMN IF NOT EXISTS "deletedAt" timestamp with time zone`,
  `ALTER TABLE public.announcements
     ADD COLUMN IF NOT EXISTS "retentionDays" integer DEFAULT 30 NOT NULL`,
  `ALTER TABLE public.announcements
     ADD COLUMN IF NOT EXISTS "deletedAt" timestamp with time zone`,
  `ALTER TABLE public.announcements
     ADD COLUMN IF NOT EXISTS attachments jsonb`,
  `ALTER TABLE public.announcement_deliveries
     ADD COLUMN IF NOT EXISTS "deletedAt" timestamp with time zone`,
  `CREATE INDEX IF NOT EXISTS idx_notification_org_deleted_created
     ON public.notifications USING btree ("organizationId", "deletedAt", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_notification_expires_active
     ON public.notifications USING btree ("expiresAt") WHERE "deletedAt" IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_announcement_org_deleted_status
     ON public.announcements USING btree ("organizationId", "deletedAt", status)`,

  `CREATE TABLE IF NOT EXISTS public.notification_cleanup_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "startedAt" timestamp with time zone NOT NULL,
    "finishedAt" timestamp with time zone,
    status character varying(16) DEFAULT 'running'::character varying NOT NULL,
    "notificationRetentionDays" integer DEFAULT 30 NOT NULL,
    "notificationsDeleted" integer DEFAULT 0 NOT NULL,
    "deliveriesDeleted" integer DEFAULT 0 NOT NULL,
    "announcementsExpired" integer DEFAULT 0 NOT NULL,
    "announcementsDeleted" integer DEFAULT 0 NOT NULL,
    error character varying(500),
    CONSTRAINT "PK_notification_cleanup_runs" PRIMARY KEY (id),
    CONSTRAINT "FK_notification_cleanup_run_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notification_cleanup_run_org_started
     ON public.notification_cleanup_runs USING btree ("organizationId", "startedAt")`,
]
