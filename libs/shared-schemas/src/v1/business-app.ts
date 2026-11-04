/**
 * Business App installation and trusted execution-context types.
 *
 * Authority:
 * - `schemas/business-app-installation.schema.json`
 *
 * These are shared types only. Validation remains on the platform side.
 */

export const BUSINESS_APP_INSTALLATION_PROTOCOL = 'business-app-installation/v1' as const

export type BusinessAppDeploymentProfile =
  | 'shared-saas'
  | 'dedicated-saas'
  | 'standalone'

export type BusinessAppStatus =
  | 'installing'
  | 'active'
  | 'suspended'
  | 'failed'
  | 'uninstalling'
  | 'removed'

export interface BusinessAppLicenseBinding {
  issuer: string
  expiresAt?: string
}

export interface BusinessAppInstallation {
  id: string
  organizationId: string
  appKey: string
  displayName: string
  slug: string
  blueprintId: string
  blueprintVersion: string
  releaseDigest: string
  runtimeRequirement: string
  deploymentProfile: BusinessAppDeploymentProfile
  status: BusinessAppStatus
  config: Record<string, unknown>
  license?: BusinessAppLicenseBinding | null
  currentRevisionId?: string | null
  createdById?: string | null
  createdAt: string
  updatedAt: string
}

export type BusinessAppRevisionAction = 'installed' | 'upgraded' | 'rollback'

export interface BusinessAppInstallationRevision {
  id: string
  organizationId: string
  appInstallationId: string
  previousRevisionId?: string | null
  packageId: string
  blueprintId: string
  blueprintVersion: string
  releaseDigest: string
  runtimeRequirement: string
  action: BusinessAppRevisionAction
  config: Record<string, unknown>
  license?: BusinessAppLicenseBinding | null
  createdById?: string | null
  createdAt: string
}

export interface BusinessAppExecutionContext {
  organizationId: string
  appInstallationId: string
  appKey: string
  userId: string
  grantedPermissions: readonly string[]
  runtimeProfile: BusinessAppDeploymentProfile
  traceId: string
}
