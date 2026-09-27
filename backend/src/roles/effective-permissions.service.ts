import { Injectable } from '@nestjs/common'
import { RolesService } from './roles.service'

export interface EffectivePermissionsInput {
  role: string
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

    const role = await this.rolesService.findByName(input.role, input.organizationId)
    const fromRole = uniquify(role?.permissions ?? [])
    return uniquify([...fromRole, ...direct])
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
