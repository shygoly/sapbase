import { RELEASE_LIFECYCLE_DDL } from './release-lifecycle.ddl'

describe('release lifecycle DDL', () => {
  const sql = RELEASE_LIFECYCLE_DDL.join('\n')

  it('guards published releases from updates and deletes', () => {
    expect(sql).toContain('trg_app_release_guard')
    expect(sql).toContain('published release is immutable')
    expect(sql).toContain('trg_app_release_no_delete')
    expect(sql).toContain('release rows are append-only')
  })

  it('enforces one active non-cohort activation per installation', () => {
    expect(sql).toContain('UQ_app_activation_single_active')
    expect(sql).toContain("status = 'active' AND cohort IS NULL")
  })

  it('has partial unique indexes for platform and tenant releases', () => {
    expect(sql).toContain('UQ_app_releases_platform')
    expect(sql).toContain('UQ_app_releases_tenant')
  })
})
