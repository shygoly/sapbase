import { Injectable } from '@nestjs/common'
import { RolesService } from './roles.service'

export interface EffectivePermissionsInput {
  role: string
  /** 组织内多角色：本组织 active 角色并集；缺省只解析 role。 */
  additionalRoles?: readonly string[]
  directPermissions: readonly string[]
  organizationId?: string
}

@Injectable()
export class EffectivePermissionsService {
  constructor(private readonly rolesService: RolesService) {}

  async resolve(input: EffectivePermissionsInput): Promise<string[]> {
    const direct = uniquify(input.directPermissions)
    if (!input.organizationId) {
      return direct
    }
    const organizationId = input.organizationId

    const roleNames = uniquify([input.role, ...(input.additionalRoles ?? [])])
    const roles = await Promise.all(
      roleNames.map((name) => this.rolesService.findByName(name, organizationId)),
    )
    const fromRoles = uniquify(roles.flatMap((role) => role?.permissions ?? []))
    return uniquify([...fromRoles, ...direct])
  }
}

function uniquify(items: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    if (!item || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}
