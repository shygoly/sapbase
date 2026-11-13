import { BadRequestException, Injectable } from '@nestjs/common'
import { AIModelsService } from './ai-models.service'
import type { AIModel } from './ai-model.entity'

export type ModelTask = 'intent' | 'design' | 'vision' | 'evaluation'

export const MODEL_TASKS: readonly ModelTask[] = [
  'intent',
  'design',
  'vision',
  'evaluation',
]

export interface ResolvedModelProfile {
  task: ModelTask
  model: AIModel
  source: 'task-profile' | 'default'
  /** 配置的 modelId（env 或 default），不含密钥。 */
  modelId: string
}

/**
 * 按任务选模型（5.7）。
 *
 * 配置来自 `AGENT_MODEL_PROFILE_<TASK>`（intent/design/vision/evaluation）；
 * 配置了但模型不存在 → fail-closed，不静默回退默认模型。
 * 未配置时回退组织默认模型。
 */
@Injectable()
export class ModelProfileService {
  constructor(private readonly models: AIModelsService) {}

  async resolve(task: ModelTask): Promise<ResolvedModelProfile> {
    this.assertTask(task)
    const modelId = process.env[`AGENT_MODEL_PROFILE_${task.toUpperCase()}`]
    if (modelId) {
      try {
        const model = await this.models.findOne(modelId)
        return { task, model, source: 'task-profile', modelId }
      } catch {
        throw new BadRequestException(
          `任务 ${task} 配置的模型不存在：${modelId}`,
        )
      }
    }
    const model = await this.models.findDefault()
    if (!model) {
      throw new BadRequestException(
        `任务 ${task} 未配置 profile，且没有默认模型`,
      )
    }
    return { task, model, source: 'default', modelId: model.id }
  }

  async list(): Promise<
    Array<{ task: ModelTask; modelId: string | null; source: 'task-profile' | 'default' | 'missing' }>
  > {
    const defaultModel = await this.models.findDefault()
    return MODEL_TASKS.map((task) => {
      const modelId = process.env[`AGENT_MODEL_PROFILE_${task.toUpperCase()}`]
      if (modelId) return { task, modelId, source: 'task-profile' }
      return {
        task,
        modelId: defaultModel?.id ?? null,
        source: defaultModel ? 'default' : 'missing',
      }
    })
  }

  private assertTask(task: string): asserts task is ModelTask {
    if (!MODEL_TASKS.includes(task as ModelTask)) {
      throw new BadRequestException(`未知模型任务：${task}`)
    }
  }
}
