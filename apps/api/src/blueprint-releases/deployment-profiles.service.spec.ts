import { BadRequestException } from '@nestjs/common'
import { DeploymentProfilesService } from './deployment-profiles.service'

const release = {
  id: 'release-1',
  blueprintId: 'erp',
  version: '1.0.0',
  packageId: 'erp-1.0.0',
  releaseDigest: `sha256:${'a'.repeat(64)}`,
  runtimeRequirement: '>=1.0.0 <2.0.0',
} as any

describe('DeploymentProfilesService', () => {
  it('三种剖面共享同一 release digest/version，且都不含源码', () => {
    const service = new DeploymentProfilesService()
    const plans = service.plan(release)
    expect(plans.map((plan) => plan.profile)).toEqual([
      'shared-saas',
      'dedicated-saas',
      'standalone',
    ])
    expect(new Set(plans.map((plan) => plan.release.releaseDigest))).toEqual(
      new Set([release.releaseDigest]),
    )
    expect(plans.every((plan) => plan.bundle.includesSource === false)).toBe(true)
    expect(plans.every((plan) => plan.bundle.artifact === 'same-runtime-artifact')).toBe(
      true,
    )
    expect(plans[0]).toMatchObject({
      data: { database: 'shared-postgres-rls', schemaStrategy: 'shared-schema' },
      runtime: { container: 'platform-shared', operations: 'platform' },
      license: { kind: 'organization-entitlement', requiresNetwork: true },
    })
    expect(plans[2]).toMatchObject({
      data: { database: 'customer-postgres', schemaStrategy: 'customer-schema' },
      runtime: { container: 'customer-hosted', operations: 'customer' },
      license: { kind: 'offline-lease', requiresNetwork: false },
    })
    expect(() => service.assertSameArtifact(plans)).not.toThrow()
  })

  it('伪造不同 digest/version 或含源码的剖面被拒绝', () => {
    const service = new DeploymentProfilesService()
    const plans = service.plan(release)
    const tampered = plans.map((plan, index) =>
      index === 1
        ? {
            ...plan,
            release: {
              ...plan.release,
              releaseDigest: `sha256:${'b'.repeat(64)}`,
            },
          }
        : plan,
    )
    expect(() => service.assertSameArtifact(tampered)).toThrow(BadRequestException)
    const withSource = plans.map((plan, index) =>
      index === 2
        ? { ...plan, bundle: { ...plan.bundle, includesSource: true } }
        : plan,
    )
    expect(() => service.assertSameArtifact(withSource as never)).toThrow(/源码/)
  })

  it('release 缺 digest/version 拒绝', () => {
    const service = new DeploymentProfilesService()
    expect(() => service.plan({ ...release, releaseDigest: '' })).toThrow(
      BadRequestException,
    )
  })
})
