import { Injectable } from '@nestjs/common'
import { IEntityStateUpdater } from './entity-state-updater.interface'

/**
 * Registry of entity state updaters by entityType.
 * Workflow controller resolves updater by instance.entityType and passes
 * it to the transition engine so entity state can be written back on transition.
 */
@Injectable()
export class EntityStateUpdaterRegistry {
  private readonly updaters = new Map<string, IEntityStateUpdater>()

  register(entityType: string, updater: IEntityStateUpdater): void {
    this.updaters.set(entityType, updater)
  }

  get(entityType: string): IEntityStateUpdater | undefined {
    return this.updaters.get(entityType)
  }

  has(entityType: string): boolean {
    return this.updaters.has(entityType)
  }
}
