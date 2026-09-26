import { BLUEPRINT_DOC_COUNTERS_DDL } from './blueprint-doc-counter.ddl'

describe('blueprint_doc_counters DDL', () => {
  it('主键按租户分区，外键用 TypeORM 哈希名', () => {
    const joined = BLUEPRINT_DOC_COUNTERS_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.blueprint_doc_counters')
    expect(joined).toContain('PRIMARY KEY ("blueprintId", "organizationId", entity, period)')
    expect(joined).toContain('PK_0d816df73344b3b37697f3cbca4')
    expect(joined).toContain('FK_17d5de0edd64a36ebb42e286d55')
    expect(joined).toContain('REFERENCES public.organizations(id)')
  })
})
