/**
 * 身份与会话 DDL 单一来源。
 * 消费方：迁移 1793300000000-CreateIdentity、空库基线、测试。
 */
export const IDENTITY_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.organization_member_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "roleId" uuid,
    "roleName" character varying(128) NOT NULL,
    source character varying(16) DEFAULT 'manual'::character varying NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    "validFrom" timestamp with time zone,
    "validTo" timestamp with time zone,
    "createdBy" uuid,
    CONSTRAINT "PK_organization_member_roles" PRIMARY KEY (id),
    CONSTRAINT "UQ_omr_org_user_role" UNIQUE ("organizationId", "userId", "roleName"),
    CONSTRAINT "FK_omr_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_omr_user" FOREIGN KEY ("userId") REFERENCES public.users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_omr_org_user_status
    ON public.organization_member_roles USING btree ("organizationId", "userId", status)`,
  `CREATE INDEX IF NOT EXISTS idx_omr_org_role_status
    ON public.organization_member_roles USING btree ("organizationId", "roleId", status)`,
]

export const AUTH_SESSION_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.auth_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    sid uuid NOT NULL,
    "refreshTokenHash" character varying(255),
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    ip character varying(64),
    "userAgent" character varying(512),
    "expiresAt" timestamp with time zone NOT NULL,
    "lastSeenAt" timestamp with time zone,
    "revokedAt" timestamp with time zone,
    "revokedReason" character varying(255),
    CONSTRAINT "PK_auth_sessions" PRIMARY KEY (id),
    CONSTRAINT "UQ_auth_sessions_sid" UNIQUE (sid),
    CONSTRAINT "FK_auth_sessions_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_auth_sessions_user" FOREIGN KEY ("userId") REFERENCES public.users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_org_user_status
    ON public.auth_sessions USING btree ("organizationId", "userId", status)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
    ON public.auth_sessions USING btree (status, "expiresAt")`,
]
