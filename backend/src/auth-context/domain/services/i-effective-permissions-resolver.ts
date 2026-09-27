/**
 * Port for resolving effective permissions (role ∪ direct) in an organization.
 */
export interface EffectivePermissionsResolveInput {
  role: string
  directPermissions: readonly string[]
  organizationId?: string
}

export interface IEffectivePermissionsResolver {
  resolve(input: EffectivePermissionsResolveInput): Promise<string[]>
}
