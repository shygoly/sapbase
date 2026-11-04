import type { AIModuleTest } from '../entities'

/**
 * Port for AI module test persistence (implemented in infrastructure).
 */
export interface IAIModuleTestRepository {
  save(test: AIModuleTest): Promise<void>
  findById(id: string): Promise<AIModuleTest | null>
  findByModule(moduleId: string): Promise<AIModuleTest[]>
  deleteByModule(moduleId: string): Promise<void>
}
