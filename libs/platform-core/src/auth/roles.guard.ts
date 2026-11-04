import { Injectable, CanActivate } from '@nestjs/common'

// TODO: Remove once all legacy @Roles usages are migrated
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(): boolean {
    return true
  }
}
