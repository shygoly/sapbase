import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Setting } from './setting.entity'
import { CreateSettingDto, UpdateSettingDto } from './dto'

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
  ) {}

  async create(userId: string, createSettingDto: CreateSettingDto): Promise<Setting> {
    // Check if user already has settings
    const existing = await this.settingsRepository.findOne({
      where: { userId },
    })

    if (existing) {
      return this.update(userId, createSettingDto)
    }

    const setting = this.settingsRepository.create({
      userId,
      ...createSettingDto,
    })
    return this.settingsRepository.save(setting)
  }

  async findByUserId(userId: string): Promise<Setting> {
    const setting = await this.settingsRepository.findOne({
      where: { userId },
    })

    if (!setting) {
      // Return default settings if not found
      return this.getDefaultSettings(userId)
    }

    return setting
  }

  async update(userId: string, updateSettingDto: UpdateSettingDto): Promise<Setting> {
    let setting = await this.settingsRepository.findOne({
      where: { userId },
    })

    if (!setting) {
      // Create with defaults if not exists
      setting = this.settingsRepository.create({
        userId,
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm:ss',
        pageSize: 10,
        fontSize: 14,
        enableNotifications: true,
      })
    }

    // Update only provided fields
    Object.assign(setting, updateSettingDto)
    return this.settingsRepository.save(setting)
  }

  private getDefaultSettings(userId: string): Setting {
    const setting = new Setting()
    setting.userId = userId
    setting.theme = 'light'
    setting.language = 'en'
    setting.timezone = 'UTC'
    setting.dateFormat = 'YYYY-MM-DD'
    setting.timeFormat = 'HH:mm:ss'
    setting.pageSize = 10
    setting.fontSize = 14
    setting.enableNotifications = true
    return setting
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
}
