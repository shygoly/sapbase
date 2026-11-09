/**
 * 异步任务 DDL 单一来源。
 * 消费方：迁移 1793200000000-CreateAsyncJobs、空库基线、测试。
 */
export const ASYNC_JOB_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS public.jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "appInstallationId" uuid,
    type character varying(128) NOT NULL,
    "typeVersion" integer DEFAULT 1 NOT NULL,
    status character varying(32) DEFAULT 'queued'::character varying NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    payload jsonb NOT NULL,
    result jsonb,
    error jsonb,
    progress integer DEFAULT 0 NOT NULL,
    "idempotencyKey" character varying(255),
    attempts integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "runAt" timestamp with time zone DEFAULT now() NOT NULL,
    "startedAt" timestamp with time zone,
    "finishedAt" timestamp with time zone,
    "leaseUntil" timestamp with time zone,
    "workerId" character varying(128),
    "cancelRequested" boolean DEFAULT false NOT NULL,
    "callbackUrl" character varying(1024),
    "callbackSecretRef" character varying(255),
    "callbackStatus" character varying(32),
    "callbackAttempts" integer DEFAULT 0 NOT NULL,
    "createdBy" uuid,
    CONSTRAINT "PK_jobs" PRIMARY KEY (id),
    CONSTRAINT "UQ_jobs_idempotency" UNIQUE ("organizationId", type, "idempotencyKey"),
    CONSTRAINT "FK_jobs_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_org_status_created
    ON public.jobs USING btree ("organizationId", status, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_status_run_priority
    ON public.jobs USING btree (status, "runAt", priority)`,

  `CREATE TABLE IF NOT EXISTS public.job_attempts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "jobId" uuid NOT NULL,
    attempt integer NOT NULL,
    status character varying(32) NOT NULL,
    error jsonb,
    "startedAt" timestamp with time zone NOT NULL,
    "finishedAt" timestamp with time zone,
    "durationMs" integer,
    CONSTRAINT "PK_job_attempts" PRIMARY KEY (id),
    CONSTRAINT "UQ_job_attempts_job_attempt" UNIQUE ("jobId", attempt),
    CONSTRAINT "FK_job_attempts_job" FOREIGN KEY ("jobId") REFERENCES public.jobs(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_attempts_job_attempt
    ON public.job_attempts USING btree ("jobId", attempt)`,

  `CREATE TABLE IF NOT EXISTS public.job_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "jobId" uuid NOT NULL,
    seq integer NOT NULL,
    type character varying(32) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT "PK_job_events" PRIMARY KEY (id),
    CONSTRAINT "UQ_job_events_job_seq" UNIQUE ("jobId", seq),
    CONSTRAINT "FK_job_events_job" FOREIGN KEY ("jobId") REFERENCES public.jobs(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_events_job_seq
    ON public.job_events USING btree ("jobId", seq)`,
]
