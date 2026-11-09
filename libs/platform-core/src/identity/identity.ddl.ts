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

export const IDENTITY_FEDERATION_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.identity_providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    key character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(16) NOT NULL,
    config jsonb,
    "secretRef" character varying(255),
    "defaultRoleName" character varying(128),
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT "PK_identity_providers" PRIMARY KEY (id),
    CONSTRAINT "UQ_identity_provider_org_key" UNIQUE ("organizationId", key),
    CONSTRAINT "FK_identity_provider_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE TABLE IF NOT EXISTS public.identity_links (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "providerId" uuid NOT NULL,
    "externalId" character varying(255) NOT NULL,
    "userId" uuid NOT NULL,
    attributes jsonb,
    "lastLoginAt" timestamp with time zone,
    CONSTRAINT "PK_identity_links" PRIMARY KEY (id),
    CONSTRAINT "UQ_identity_link_provider_external" UNIQUE ("organizationId", "providerId", "externalId"),
    CONSTRAINT "FK_identity_link_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_identity_link_provider" FOREIGN KEY ("providerId") REFERENCES public.identity_providers(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS public.auth_login_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid,
    email character varying(255) NOT NULL,
    provider character varying(64) DEFAULT 'password'::character varying NOT NULL,
    status character varying(32) NOT NULL,
    ip character varying(64),
    "userAgent" character varying(512),
    reason character varying(255),
    metadata jsonb,
    CONSTRAINT "PK_auth_login_events" PRIMARY KEY (id),
    CONSTRAINT "FK_auth_login_event_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auth_login_event_org_created
    ON public.auth_login_events USING btree ("organizationId", "createdAt")`,
  `CREATE TABLE IF NOT EXISTS public.identity_sync_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "providerId" uuid NOT NULL,
    status character varying(32) DEFAULT 'running'::character varying NOT NULL,
    stats jsonb,
    error jsonb,
    "startedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "finishedAt" timestamp with time zone,
    CONSTRAINT "PK_identity_sync_runs" PRIMARY KEY (id),
    CONSTRAINT "FK_identity_sync_run_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id),
    CONSTRAINT "FK_identity_sync_run_provider" FOREIGN KEY ("providerId") REFERENCES public.identity_providers(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS public.service_clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    key character varying(128) NOT NULL,
    name character varying(255) NOT NULL,
    "secretHash" character varying(255) NOT NULL,
    scopes jsonb,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    "expiresAt" timestamp with time zone,
    "lastUsedAt" timestamp with time zone,
    "ipAllowlist" jsonb,
    CONSTRAINT "PK_service_clients" PRIMARY KEY (id),
    CONSTRAINT "UQ_service_client_org_key" UNIQUE ("organizationId", key),
    CONSTRAINT "FK_service_client_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
]
