import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AIModel, AIModelProvider, AIModelStatus } from './ai-model.entity'
import axios from 'axios'

@Injectable()
export class AIModelsService {
  constructor(
    @InjectRepository(AIModel)
    private aiModelRepository: Repository<AIModel>,
  ) {}

  async findAll(): Promise<AIModel[]> {
    return this.aiModelRepository.find({
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string): Promise<AIModel> {
    const model = await this.aiModelRepository.findOne({ where: { id } })
    if (!model) {
      throw new NotFoundException(`AI Model with ID ${id} not found`)
    }
    return model
  }

  async findDefault(): Promise<AIModel | null> {
    return this.aiModelRepository.findOne({ where: { isDefault: true, status: AIModelStatus.ACTIVE } })
  }

  async create(createDto: Partial<AIModel>): Promise<AIModel> {
    // If setting as default, unset other defaults
    if (createDto.isDefault) {
      await this.aiModelRepository.update({ isDefault: true }, { isDefault: false })
    }

    const model = this.aiModelRepository.create(createDto)
    return this.aiModelRepository.save(model)
  }

  async update(id: string, updateDto: Partial<AIModel>): Promise<AIModel> {
    const model = await this.findOne(id)

    // If setting as default, unset other defaults
    if (updateDto.isDefault && !model.isDefault) {
      await this.aiModelRepository.update({ isDefault: true }, { isDefault: false })
    }

    Object.assign(model, updateDto)
    return this.aiModelRepository.save(model)
  }

  async delete(id: string): Promise<void> {
    const model = await this.findOne(id)
    await this.aiModelRepository.remove(model)
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const model = await this.findOne(id)

    if (!model.apiKey) {
      return { success: false, message: 'API key is required' }
    }

    try {
      // Test connection based on provider
      if (model.provider === AIModelProvider.KIMI) {
        const baseUrl = model.baseUrl || 'https://api.kimi.com/coding/'
        const testUrl = `${baseUrl.replace(/\/$/, '')}/v1/messages`
        
        // Send a simple test request
        const response = await axios.post(
          testUrl,
          {
            model: model.model || 'kimi-for-coding',
            messages: [
              {
                role: 'user',
                content: 'test',
              },
            ],
            max_tokens: 10,
          },
          {
            headers: {
              'Authorization': `Bearer ${model.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        )

        if (response.status === 200) {
          // Update last tested timestamp
          model.lastTestedAt = new Date()
          model.status = AIModelStatus.ACTIVE
          await this.aiModelRepository.save(model)

          return { success: true, message: 'Connection successful' }
        } else {
          throw new Error(`Unexpected status: ${response.status}`)
        }
      } else {
        throw new BadRequestException(`Provider ${model.provider} not yet supported`)
      }
    } catch (error) {
      model.status = AIModelStatus.INACTIVE
      await this.aiModelRepository.save(model)
      
      const message = error instanceof Error ? error.message : 'Connection failed'
      return { success: false, message }
    }
  }
}
