import type { AIModule } from '../entities'

/**
 * Port for AI module persistence (implemented in infrastructure).
 */
export interface IAIModuleRepository {
  save(module: AIModule): Promise<void>
  findById(id: string, organizationId: string): Promise<AIModule | null>
  findAll(organizationId: string, status?: string): Promise<AIModule[]>
  delete(id: string, organizationId: string): Promise<void>
}
