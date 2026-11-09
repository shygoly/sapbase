/**
 * 通知中心扩展 DDL：字段扩展 + 偏好/公告/受众/投递。
 * 迁移 179380 消费；已有 `NOTIFICATIONS_DDL` 保持原样，避免改写历史迁移语义。
 */
export const NOTIFICATION_CENTER_DDL: string[] = [
  `ALTER TABLE public.notifications
     ADD COLUMN IF NOT EXISTS category character varying(32) DEFAULT 'system' NOT NULL`,
  `ALTER TABLE public.notifications
     ADD COLUMN IF NOT EXISTS priority character varying(16) DEFAULT 'normal' NOT NULL`,
  `ALTER TABLE public.notifications
     ADD COLUMN IF NOT EXISTS "actionUrl" character varying(1024)`,
  `ALTER TABLE public.notifications
     ADD COLUMN IF NOT EXISTS "expiresAt" timestamp with time zone`,
  `ALTER TABLE public.notifications
     ADD COLUMN IF NOT EXISTS "readAt" timestamp with time zone`,
  `ALTER TABLE public.notifications
     ADD COLUMN IF NOT EXISTS mandatory boolean DEFAULT false NOT NULL`,
  `UPDATE public.notifications
      SET category = 'system' WHERE category IS NULL`,
  `UPDATE public.notifications
      SET priority = 'normal' WHERE priority IS NULL`,
  `UPDATE public.notifications
      SET "readAt" = "createdAt" WHERE read = true AND "readAt" IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_notification_org_category_created
     ON public.notifications USING btree ("organizationId", category, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_notification_user_read_expires
     ON public.notifications USING btree ("userId", read, "expiresAt")`,

  `CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    category character varying(32) NOT NULL,
    "inApp" boolean DEFAULT true NOT NULL,
    email boolean DEFAULT true NOT NULL,
    push boolean DEFAULT false NOT NULL,
    "mutedUntil" timestamp with time zone,
    CONSTRAINT "PK_notification_preferences" PRIMARY KEY (id),
    CONSTRAINT "UQ_notification_pref_org_user_category" UNIQUE ("organizationId", "userId", category),
    CONSTRAINT "FK_notification_pref_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,

  `CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    body text NOT NULL,
    status character varying(32) DEFAULT 'draft'::character varying NOT NULL,
    "audienceType" character varying(32) DEFAULT 'all'::character varying NOT NULL,
    "publishAt" timestamp with time zone,
    "expiresAt" timestamp with time zone,
    "publishedAt" timestamp with time zone,
    "withdrawnAt" timestamp with time zone,
    "createdBy" uuid,
    CONSTRAINT "PK_announcements" PRIMARY KEY (id),
    CONSTRAINT "FK_announcement_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_announcement_org_status
     ON public.announcements USING btree ("organizationId", status, "publishAt")`,

  `CREATE TABLE IF NOT EXISTS public.announcement_audiences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "announcementId" uuid NOT NULL,
    "audienceType" character varying(32) NOT NULL,
    "audienceValue" character varying(255) NOT NULL,
    CONSTRAINT "PK_announcement_audiences" PRIMARY KEY (id),
    CONSTRAINT "UQ_announcement_audience" UNIQUE ("announcementId", "audienceType", "audienceValue"),
    CONSTRAINT "FK_announcement_audience_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_announcement_audience_announcement" FOREIGN KEY ("announcementId") REFERENCES public.announcements(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS public.announcement_deliveries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "announcementId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    "deliveredAt" timestamp with time zone,
    "readAt" timestamp with time zone,
    error character varying(255),
    CONSTRAINT "PK_announcement_deliveries" PRIMARY KEY (id),
    CONSTRAINT "UQ_announcement_delivery" UNIQUE ("announcementId", "userId"),
    CONSTRAINT "FK_announcement_delivery_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_announcement_delivery_announcement" FOREIGN KEY ("announcementId") REFERENCES public.announcements(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_announcement_delivery_org_status
     ON public.announcement_deliveries USING btree ("organizationId", status)`,
]
