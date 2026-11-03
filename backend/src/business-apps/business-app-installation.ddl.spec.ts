import { BUSINESS_APP_INSTALLATIONS_DDL } from './business-app-installation.ddl'

describe('business app installation DDL', () => {
  it('以组织为边界并阻止同一组织重复 appKey/slug', () => {
    const joined = BUSINESS_APP_INSTALLATIONS_DDL.join('\n')
    expect(joined).toContain('"organizationId" uuid NOT NULL')
    expect(joined).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_installations_organization_app_key"',
    )
    expect(joined).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_app_installations_organization_slug"',
    )
    expect(joined).toContain('ON DELETE CASCADE')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.app_installation_revisions')
    expect(joined).toContain(
      'FOREIGN KEY ("appInstallationId") REFERENCES public.app_installations(id) ON DELETE CASCADE',
    )
    expect(joined).toContain('WHERE ai."currentRevisionId" IS NULL')
  })
})
