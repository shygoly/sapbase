// 由 scripts/generate-schema-baseline.ts 从实体定义生成，请勿手改。
// 重新生成：npx ts-node --transpile-only scripts/generate-schema-baseline.ts --to=sapbase_gen
//
// blueprint_records 例外：DDL 只有一份（semantic-runtime/blueprint-record.ddl.ts），
// 追加在末尾以便 organizations 已存在，三处（迁移 / 基线 / e2e）共用。
import { BLUEPRINT_RECORDS_DDL } from '../semantic-runtime/blueprint-record.ddl'

export const SCHEMA_BASELINE_SQL: string[] = [
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
  `CREATE TABLE public.ai_models (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    name character varying(100) NOT NULL,
    provider character varying(50) NOT NULL,
    "apiKey" character varying(255),
    "baseUrl" character varying(500),
    model character varying(100),
    status character varying(50) DEFAULT 'inactive'::character varying NOT NULL,
    description text,
    config jsonb,
    "lastTestedAt" timestamp without time zone,
    "isDefault" boolean DEFAULT false NOT NULL
)`,
  `CREATE TABLE public.ai_module_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "aiModuleId" uuid NOT NULL,
    "step1_objectModel" jsonb,
    step2_relationships jsonb,
    "step3_stateFlow" jsonb,
    step4_pages jsonb,
    step5_permissions jsonb,
    step6_reports jsonb,
    "mergedDefinition" jsonb
)`,
  `CREATE TABLE public.ai_module_reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "moduleId" uuid NOT NULL,
    "reviewerId" uuid NOT NULL,
    decision character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    comments text,
    "rejectionReason" text,
    "reviewedAt" timestamp without time zone,
    "reviewData" jsonb
)`,
  `CREATE TABLE public.ai_module_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "moduleId" uuid NOT NULL,
    "testName" character varying(255) NOT NULL,
    "entityType" character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "errorMessage" text,
    "testData" jsonb,
    result jsonb,
    "executedAt" timestamp without time zone,
    duration integer
)`,
  `CREATE TABLE public.ai_modules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "naturalLanguagePrompt" text,
    "patchContent" jsonb NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    version character varying(50) DEFAULT '1.0.0'::character varying NOT NULL,
    "aiModelId" uuid,
    "createdById" uuid,
    "reviewedById" uuid,
    "reviewedAt" timestamp without time zone,
    "reviewComments" text,
    "publishedAt" timestamp without time zone,
    "unpublishedAt" timestamp without time zone,
    "testResults" jsonb,
    metadata jsonb
)`,
  `CREATE TABLE public.atomic_contracts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "atomicType" character varying(64) NOT NULL,
    version character varying(32) NOT NULL,
    kind character varying(32) NOT NULL,
    description character varying(500),
    status character varying(32) DEFAULT 'draft'::character varying NOT NULL,
    "inputSchema" jsonb NOT NULL,
    "outputSchema" jsonb NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    idempotency character varying(32) DEFAULT 'none'::character varying NOT NULL,
    "cpuBudget" bigint,
    "outputAudit" character varying(16) DEFAULT 'standard'::character varying NOT NULL,
    "organizationId" uuid
)`,
  `CREATE TABLE public.atomic_implementations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "atomicContractId" uuid NOT NULL,
    kind character varying(32) NOT NULL,
    "moduleSha256" character varying(64),
    "abiVersion" integer,
    tier character varying(2),
    review jsonb,
    "reproducibleBuildRef" character varying(255),
    "sourceGate" jsonb,
    "staticGate" jsonb,
    "releaseEvidence" jsonb,
    status character varying(32) DEFAULT 'submitted'::character varying NOT NULL
)`,
  `CREATE TABLE public.atomic_module_manifests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "atomicType" character varying(128) NOT NULL,
    file character varying(255) NOT NULL,
    sha256 character varying(64) NOT NULL,
    tier character varying(2) NOT NULL,
    "sizeBytes" integer NOT NULL,
    "importedBy" character varying(64) NOT NULL,
    "manifestSnapshot" jsonb NOT NULL
)`,
  `CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    action character varying NOT NULL,
    resource character varying NOT NULL,
    actor character varying NOT NULL,
    status character varying(50) NOT NULL,
    "resourceId" uuid,
    changes jsonb,
    metadata jsonb,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE public.brand_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "logoUrl" character varying(500),
    "faviconUrl" character varying(500),
    theme jsonb,
    "customCss" text,
    "appName" character varying(255),
    "supportEmail" character varying(255),
    "supportUrl" character varying(500)
)`,
  `CREATE TABLE public.departments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "managerId" uuid,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL
)`,
  `CREATE TABLE public.invitations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying NOT NULL,
    "invitedById" uuid NOT NULL,
    "invitedAt" timestamp without time zone DEFAULT now() NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    token character varying(255) NOT NULL,
    "expiresAt" timestamp without time zone
)`,
  `CREATE TABLE public.menu_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    label character varying NOT NULL,
    path character varying,
    icon character varying,
    permissions text,
    visible boolean DEFAULT true NOT NULL,
    disabled boolean DEFAULT false NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "parentId" uuid
)`,
  `CREATE TABLE public.module_capabilities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "moduleId" uuid NOT NULL,
    "capabilityType" character varying(50) NOT NULL,
    entity character varying(255),
    operations jsonb DEFAULT '[]'::jsonb NOT NULL,
    "apiEndpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
    description text
)`,
  `CREATE TABLE public.module_configurations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "moduleId" uuid NOT NULL,
    "configType" character varying(100) NOT NULL,
    schema jsonb,
    documentation text,
    metadata jsonb
)`,
  `CREATE TABLE public.module_registry (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "moduleType" character varying(50) DEFAULT 'crud'::character varying NOT NULL,
    "dependsOnAtomics" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "aiModelId" uuid,
    "createdById" uuid,
    version character varying(50) DEFAULT '1.0.0'::character varying NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    "aiModuleId" uuid,
    metadata jsonb
)`,
  `CREATE TABLE public.module_relationships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "sourceModuleId" uuid NOT NULL,
    "targetModuleId" uuid NOT NULL,
    "relationshipType" character varying(50) NOT NULL,
    description text,
    configuration jsonb
)`,
  `CREATE TABLE public.module_statistics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "moduleId" uuid NOT NULL,
    entity character varying(255),
    "recordCount" integer DEFAULT 0 NOT NULL,
    "lastUpdate" timestamp without time zone,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "averageResponseTime" double precision,
    "healthStatus" character varying(50) DEFAULT 'healthy'::character varying NOT NULL,
    "collectedAt" timestamp without time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE public.organization_activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid,
    action character varying(100) NOT NULL,
    description text,
    metadata jsonb,
    "ipAddress" character varying(45),
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
)`,
  `CREATE TABLE public.organization_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying NOT NULL,
    "joinedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "invitedById" uuid
)`,
  `CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    "stripeCustomerId" character varying(255),
    "stripeSubscriptionId" character varying(255),
    "stripeProductId" character varying(255),
    "planName" character varying(50),
    "subscriptionStatus" character varying(50) DEFAULT 'incomplete'::character varying NOT NULL
)`,
  `CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL
)`,
  `CREATE TABLE public.plugins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "organizationId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    name character varying(255) NOT NULL,
    version character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    manifest jsonb NOT NULL,
    status character varying(50) DEFAULT 'installed'::character varying NOT NULL,
    "installPath" character varying(500) NOT NULL
)`,
  `CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    permissions text DEFAULT ''::text NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL
)`,
  `CREATE TABLE public.settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    theme character varying(20) DEFAULT 'light'::character varying NOT NULL,
    language character varying(10) DEFAULT 'en'::character varying NOT NULL,
    timezone character varying(50) DEFAULT 'UTC'::character varying NOT NULL,
    "dateFormat" character varying(20) DEFAULT 'YYYY-MM-DD'::character varying NOT NULL,
    "timeFormat" character varying(20) DEFAULT 'HH:mm:ss'::character varying NOT NULL,
    "pageSize" integer DEFAULT 10 NOT NULL,
    "fontSize" integer DEFAULT 14 NOT NULL,
    "enableNotifications" boolean DEFAULT true NOT NULL
)`,
  `CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    "passwordHash" character varying(255),
    role character varying(255) DEFAULT 'user'::character varying NOT NULL,
    department character varying(255),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    permissions text DEFAULT ''::text NOT NULL
)`,
  `CREATE TABLE public.workflow_auto_suggestion_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "workflowInstanceId" uuid NOT NULL,
    "organizationId" character varying NOT NULL,
    "suggestedToState" character varying(255) NOT NULL,
    reason text
)`,
  `CREATE TABLE public.workflow_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    "entityType" character varying(255) NOT NULL,
    states jsonb NOT NULL,
    transitions jsonb NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    version character varying(50) DEFAULT '1.0.0'::character varying NOT NULL,
    metadata jsonb
)`,
  `CREATE TABLE public.workflow_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "workflowInstanceId" uuid NOT NULL,
    "fromState" character varying(255),
    "toState" character varying(255) NOT NULL,
    "triggeredById" uuid,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    "guardResult" jsonb,
    "actionResult" jsonb,
    metadata jsonb
)`,
  `CREATE TABLE public.workflow_instances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "workflowDefinitionId" uuid NOT NULL,
    "entityType" character varying(255) NOT NULL,
    "entityId" character varying(255) NOT NULL,
    "currentState" character varying(255) NOT NULL,
    context jsonb,
    status character varying(50) DEFAULT 'running'::character varying NOT NULL,
    "startedById" uuid,
    "startedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "completedAt" timestamp without time zone
)`,
  `ALTER TABLE ONLY public.brand_configs
    ADD CONSTRAINT "PK_004b185289bc597080245cf78f8" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.settings
    ADD CONSTRAINT "PK_0669fe20e252eb692bf4d344975" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.module_configurations
    ADD CONSTRAINT "PK_18696f4875d83a8ad77600ed95b" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.atomic_contracts
    ADD CONSTRAINT "PK_357f1030bb86a1f2ed81202a54d" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.ai_module_reviews
    ADD CONSTRAINT "PK_37feed2c0be07015bbd1b8474d2" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT "PK_3d254744f0bcf6f35be5826e25e" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT "PK_4f92fadfc5fb722f080ceaec272" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.atomic_module_manifests
    ADD CONSTRAINT "PK_55cda954bbb5489a4c6f51d18d3" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT "PK_57e6188f929e5dc6919168620c8" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.ai_modules
    ADD CONSTRAINT "PK_5804a664a17d78240e489692c1e" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "PK_5dec98cfdfd562e4ad3648bbb07" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.ai_module_definitions
    ADD CONSTRAINT "PK_6d7da47e6c841bf9de0d033afcc" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.module_registry
    ADD CONSTRAINT "PK_72790971912c75d19fd814c73f4" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.ai_module_tests
    ADD CONSTRAINT "PK_8a78c1b08964b8acdca248021e5" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT "PK_90cc94e44ff8b7b7869f50e4fc4" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.module_statistics
    ADD CONSTRAINT "PK_9bed1adf9d84937d91c6219e4df" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.module_capabilities
    ADD CONSTRAINT "PK_a1f8061b041b49831e1e41e2553" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.plugins
    ADD CONSTRAINT "PK_bb3d17826b76295957a253ba73e" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.workflow_auto_suggestion_logs
    ADD CONSTRAINT "PK_c0b170c5099c182eed62732c00a" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT "PK_c2b39d5d072886a4d9c8105eb9a" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.module_relationships
    ADD CONSTRAINT "PK_c7a45c668af539c9ed9b715b778" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.organization_activities
    ADD CONSTRAINT "PK_e13b7949ae7df5ca4100063fec0" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.atomic_implementations
    ADD CONSTRAINT "PK_ea00b2da458cd4e0725bcc78965" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT "PK_fea2a8522a65a196224b276dbd9" PRIMARY KEY (id)`,
  `ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE (slug)`,
  `ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email)`,
  `ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "UQ_a26328e80a3f4e77d922c55cdf8" UNIQUE ("stripeCustomerId")`,
  `ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "UQ_c7ea3c9a8e0c338e4db74374b6f" UNIQUE ("stripeSubscriptionId")`,
  `ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "UQ_e577dcf9bb6d084373ed3998509" UNIQUE (token)`,
  `CREATE INDEX idx_ai_module_organization ON public.ai_modules USING btree ("organizationId")`,
  `CREATE INDEX idx_atomic_contracts_organization ON public.atomic_contracts USING btree ("organizationId")`,
  `CREATE UNIQUE INDEX idx_atomic_contracts_type_version ON public.atomic_contracts USING btree ("atomicType", version)`,
  `CREATE INDEX idx_atomic_implementations_contract ON public.atomic_implementations USING btree ("atomicContractId")`,
  `CREATE INDEX idx_atomic_implementations_sha256 ON public.atomic_implementations USING btree ("moduleSha256")`,
  `CREATE UNIQUE INDEX idx_atomic_module_manifests_sha256 ON public.atomic_module_manifests USING btree (sha256)`,
  `CREATE INDEX idx_audit_log_action ON public.audit_logs USING btree (action)`,
  `CREATE INDEX idx_audit_log_actor ON public.audit_logs USING btree (actor)`,
  `CREATE INDEX idx_audit_log_organization ON public.audit_logs USING btree ("organizationId")`,
  `CREATE INDEX idx_audit_log_resource_id ON public.audit_logs USING btree ("resourceId")`,
  `CREATE INDEX idx_audit_log_timestamp ON public.audit_logs USING btree ("timestamp")`,
  `CREATE INDEX idx_auto_suggestion_created ON public.workflow_auto_suggestion_logs USING btree ("createdAt")`,
  `CREATE INDEX idx_auto_suggestion_instance ON public.workflow_auto_suggestion_logs USING btree ("workflowInstanceId")`,
  `CREATE INDEX idx_department_organization ON public.departments USING btree ("organizationId")`,
  `CREATE INDEX idx_menu_organization ON public.menu_items USING btree ("organizationId")`,
  `CREATE INDEX idx_module_registry_organization ON public.module_registry USING btree ("organizationId")`,
  `CREATE INDEX idx_permission_organization ON public.permissions USING btree ("organizationId")`,
  `CREATE UNIQUE INDEX idx_permission_organization_name ON public.permissions USING btree ("organizationId", name)`,
  `CREATE UNIQUE INDEX idx_plugins_organization_name ON public.plugins USING btree ("organizationId", name)`,
  `CREATE INDEX idx_role_organization ON public.roles USING btree ("organizationId")`,
  `CREATE UNIQUE INDEX idx_role_organization_name ON public.roles USING btree ("organizationId", name)`,
  `CREATE INDEX idx_setting_organization ON public.settings USING btree ("organizationId")`,
  `CREATE INDEX idx_setting_user_id ON public.settings USING btree ("userId")`,
  `CREATE INDEX idx_workflow_def_entity_type ON public.workflow_definitions USING btree ("entityType")`,
  `CREATE INDEX idx_workflow_def_organization ON public.workflow_definitions USING btree ("organizationId")`,
  `CREATE INDEX idx_workflow_history_instance ON public.workflow_history USING btree ("workflowInstanceId")`,
  `CREATE INDEX idx_workflow_history_timestamp ON public.workflow_history USING btree ("timestamp")`,
  `CREATE INDEX idx_workflow_instance_entity ON public.workflow_instances USING btree ("entityType", "entityId")`,
  `CREATE INDEX idx_workflow_instance_organization ON public.workflow_instances USING btree ("organizationId")`,
  `CREATE INDEX idx_workflow_instance_workflow ON public.workflow_instances USING btree ("workflowDefinitionId")`,
  `ALTER TABLE ONLY public.module_capabilities
    ADD CONSTRAINT "FK_0321cb8a89076998e7f35ba9066" FOREIGN KEY ("moduleId") REFERENCES public.module_registry(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT "FK_04ba9a1546aa90eb39497739abe" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT "FK_0875164e0974d4baba08954376e" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "FK_0933e1dfb2993d672af1a98f08e" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.ai_modules
    ADD CONSTRAINT "FK_1f95da433ea38b3ac657b863d2a" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.brand_configs
    ADD CONSTRAINT "FK_2404d2fd8493df3284b0cb9e438" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "FK_2d031e6155834882f54dcd6b4f5" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT "FK_4b377f691b22b8ae05721074dbd" FOREIGN KEY ("workflowDefinitionId") REFERENCES public.workflow_definitions(id)`,
  `ALTER TABLE ONLY public.module_registry
    ADD CONSTRAINT "FK_4d921953b3779e5808edc352b87" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT "FK_5652c2c6b066835b6c500d0d83f" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.ai_module_reviews
    ADD CONSTRAINT "FK_5f279df3997dcdea8ddcf69524b" FOREIGN KEY ("reviewerId") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.organization_activities
    ADD CONSTRAINT "FK_669772fa2217990fc8956e674ca" FOREIGN KEY ("userId") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT "FK_67843cfa11173d1f5c2dc66315b" FOREIGN KEY ("startedById") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.organization_activities
    ADD CONSTRAINT "FK_6d23198e36b7f7bd398f57a3dc9" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.workflow_auto_suggestion_logs
    ADD CONSTRAINT "FK_71ab709089365a1b3b7d14cf328" FOREIGN KEY ("workflowInstanceId") REFERENCES public.workflow_instances(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.ai_modules
    ADD CONSTRAINT "FK_72b3691b84533d2e2f48f2266e7" FOREIGN KEY ("reviewedById") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.module_configurations
    ADD CONSTRAINT "FK_86800e7721afb60d97fdd5a6863" FOREIGN KEY ("moduleId") REFERENCES public.module_registry(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT "FK_8b15ad8a1664a5637a6b4aea861" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.module_registry
    ADD CONSTRAINT "FK_8c42710f5abd8ffbeb2b7f6bca1" FOREIGN KEY ("createdById") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.settings
    ADD CONSTRAINT "FK_9175e059b0a720536f7726a88c7" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "FK_993b02c38468ae34fbf896928cd" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.module_relationships
    ADD CONSTRAINT "FK_9a483899b8feb2e0ef0136eae8b" FOREIGN KEY ("targetModuleId") REFERENCES public.module_registry(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "FK_9c12b32b01521c1c3595a55b106" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.ai_modules
    ADD CONSTRAINT "FK_9dac45aecab5482b098450acd75" FOREIGN KEY ("createdById") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.module_relationships
    ADD CONSTRAINT "FK_a751b5b0b5c263fda7e6c61e484" FOREIGN KEY ("sourceModuleId") REFERENCES public.module_registry(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.module_registry
    ADD CONSTRAINT "FK_aa7d969510f70ccba10a0b95622" FOREIGN KEY ("aiModuleId") REFERENCES public.ai_modules(id)`,
  `ALTER TABLE ONLY public.ai_modules
    ADD CONSTRAINT "FK_b1d6b2a384652b17ec75555ed5d" FOREIGN KEY ("aiModelId") REFERENCES public.ai_models(id)`,
  `ALTER TABLE ONLY public.ai_module_definitions
    ADD CONSTRAINT "FK_b272912418304dec6d9b0ece5e8" FOREIGN KEY ("aiModuleId") REFERENCES public.ai_modules(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT "FK_b3b0daffdc6cd8e30cca39ccc5e" FOREIGN KEY ("parentId") REFERENCES public.menu_items(id)`,
  `ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "FK_b60325e5302be0dad38b423314c" FOREIGN KEY ("invitedById") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "FK_b9139f00cebfadced76bca3084f" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT "FK_b9f1856686f1a1c440a7a235082" FOREIGN KEY ("invitedById") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.settings
    ADD CONSTRAINT "FK_bb28cfb79130cf7137fee957bbe" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.atomic_implementations
    ADD CONSTRAINT "FK_bfd3f8e086e73ddae4e57c40649" FOREIGN KEY ("atomicContractId") REFERENCES public.atomic_contracts(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.module_registry
    ADD CONSTRAINT "FK_c13192077dabec6c19c26101624" FOREIGN KEY ("aiModelId") REFERENCES public.ai_models(id)`,
  `ALTER TABLE ONLY public.module_statistics
    ADD CONSTRAINT "FK_c6d90e981e4fbdf6de40d5acab0" FOREIGN KEY ("moduleId") REFERENCES public.module_registry(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT "FK_cc2eff6656354042b33ced2cead" FOREIGN KEY ("triggeredById") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.atomic_contracts
    ADD CONSTRAINT "FK_d0908dd99049271519fcee9a611" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)`,
  `ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT "FK_dfee70cc129f7d3cc04463b0675" FOREIGN KEY ("workflowInstanceId") REFERENCES public.workflow_instances(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.ai_module_reviews
    ADD CONSTRAINT "FK_e4b356ece461bf5cdcab8cb916e" FOREIGN KEY ("moduleId") REFERENCES public.ai_modules(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT "FK_e826222ad017663c6db1a45a4f1" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE`,
  `ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "FK_f6414ec030ca08823b25e03cd9d" FOREIGN KEY ("managerId") REFERENCES public.users(id)`,
  `ALTER TABLE ONLY public.ai_module_tests
    ADD CONSTRAINT "FK_f8c1a6e482e1f543783a95451c6" FOREIGN KEY ("moduleId") REFERENCES public.ai_modules(id) ON DELETE CASCADE`,
  ...BLUEPRINT_RECORDS_DDL,
]
