import type { AIModuleReview } from '../entities'

/**
 * Port for AI module review persistence (implemented in infrastructure).
 */
export interface IAIModuleReviewRepository {
  save(review: AIModuleReview): Promise<void>
  findById(id: string): Promise<AIModuleReview | null>
  findByModule(moduleId: string): Promise<AIModuleReview[]>
  findLatestByModule(moduleId: string): Promise<AIModuleReview | null>
}
