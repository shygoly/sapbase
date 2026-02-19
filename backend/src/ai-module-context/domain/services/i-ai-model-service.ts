/**
 * Port for AI model service (implemented in infrastructure).
 */
export interface AIModel {
  id: string
  name: string
  model: string
  baseUrl: string | null
  apiKey: string
}

export interface IAIModelService {
  findDefault(): Promise<AIModel | null>
  generatePatch(prompt: string, context?: string): Promise<Record<string, any>>
  generateFromDefinition(definition: Record<string, any>): Promise<Record<string, any>>
}
