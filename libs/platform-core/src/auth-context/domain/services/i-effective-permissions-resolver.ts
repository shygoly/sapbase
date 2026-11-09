/**
 * Port for resolving effective permissions (role ∪ direct) in an organization.
 */
export interface EffectivePermissionsResolveInput {
  role: string
  /** 组织内多角色；由登录/切换组织用例解析后传入。 */
  additionalRoles?: readonly string[]
  directPermissions: readonly string[]
  organizationId?: string
}

export interface IEffectivePermissionsResolver {
  resolve(input: EffectivePermissionsResolveInput): Promise<string[]>
}
