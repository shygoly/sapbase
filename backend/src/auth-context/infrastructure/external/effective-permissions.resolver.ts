import { Injectable } from '@nestjs/common'
import { EffectivePermissionsService } from '../../../roles/effective-permissions.service'
import type {
  EffectivePermissionsResolveInput,
  IEffectivePermissionsResolver,
} from '../../domain/services'

@Injectable()
export class EffectivePermissionsResolver implements IEffectivePermissionsResolver {
  constructor(private readonly effectivePermissions: EffectivePermissionsService) {}

  resolve(input: EffectivePermissionsResolveInput): Promise<string[]> {
    return this.effectivePermissions.resolve(input)
  }
}
