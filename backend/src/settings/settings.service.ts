import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Setting } from './setting.entity'

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
  ) {}

  async create(key: string, value: string, description?: string): Promise<Setting> {
    const setting = this.settingsRepository.create({ key, value, description })
    return this.settingsRepository.save(setting)
  }

  async findAll(): Promise<Setting[]> {
    return this.settingsRepository.find()
  }

  async findOne(id: string): Promise<Setting> {
    const setting = await this.settingsRepository.findOne({
      where: { id },
    })

    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`)
    }

    return setting
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.settingsRepository.findOne({
      where: { key },
    })
  }

  async update(id: string, value: string): Promise<Setting> {
    await this.findOne(id)
    await this.settingsRepository.update(id, { value })
    return this.findOne(id)
  }
}
