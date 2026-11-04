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

  async create(userId: string, createSettingDto: CreateSettingDto, organizationId: string): Promise<Setting> {
    // Check if user already has settings for this organization
    const existing = await this.settingsRepository.findOne({
      where: { userId, organizationId },
    })

    if (existing) {
      return this.update(userId, createSettingDto, organizationId)
    }

    const setting = this.settingsRepository.create({
      userId,
      organizationId,
      ...createSettingDto,
    })
    return this.settingsRepository.save(setting)
  }

  async findByUserId(userId: string, organizationId: string): Promise<Setting> {
    const setting = await this.settingsRepository.findOne({
      where: { userId, organizationId },
    })

    if (!setting) {
      // Return default settings if not found
      return this.getDefaultSettings(userId, organizationId)
    }

    return setting
  }

  async update(userId: string, updateSettingDto: UpdateSettingDto, organizationId: string): Promise<Setting> {
    let setting = await this.settingsRepository.findOne({
      where: { userId, organizationId },
    })

    if (!setting) {
      // Create with defaults if not exists
      setting = this.settingsRepository.create({
        userId,
        organizationId,
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

  private getDefaultSettings(userId: string, organizationId: string): Setting {
    const setting = new Setting()
    setting.userId = userId
    setting.organizationId = organizationId
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

  async findAll(organizationId: string): Promise<Setting[]> {
    return this.settingsRepository.find({
      where: { organizationId },
    })
  }

  async findOne(id: string, organizationId: string): Promise<Setting> {
    const setting = await this.settingsRepository.findOne({
      where: { id, organizationId },
    })

    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`)
    }

    return setting
  }
}
