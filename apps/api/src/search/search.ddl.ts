/**
 * 搜索索引 DDL：PostgreSQL 全文（tsvector）+ trigram 兜底，GIN 索引。
 * 不引入外部搜索集群；索引是可重建派生物。
 */
export const SEARCH_DDL: string[] = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  `CREATE TABLE IF NOT EXISTS public.search_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "organizationId" uuid NOT NULL,
    "resourceKey" character varying(64) NOT NULL,
    "resourceId" character varying(128) NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "contentHash" character varying(64) NOT NULL,
    "indexedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "PK_search_documents" PRIMARY KEY (id),
    CONSTRAINT "UQ_search_document_org_resource" UNIQUE ("organizationId", "resourceKey", "resourceId"),
    CONSTRAINT "FK_search_document_org" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_search_document_org_resource
     ON public.search_documents USING btree ("organizationId", "resourceKey", "indexedAt")`,
  `CREATE INDEX IF NOT EXISTS idx_search_document_tsv
     ON public.search_documents USING gin (
       to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
     )`,
  `CREATE INDEX IF NOT EXISTS idx_search_document_title_trgm
     ON public.search_documents USING gin (title gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_search_document_body_trgm
     ON public.search_documents USING gin (body gin_trgm_ops)`,
]
