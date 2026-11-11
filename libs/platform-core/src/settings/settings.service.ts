import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Setting } from './setting.entity'
import { CreateSettingDto, UpdateSettingDto } from './dto'

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
    @Optional() private readonly auditLogs?: AuditLogsService,
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
    const saved = await this.settingsRepository.save(setting)
    await this.auditLogs?.create({
      organizationId,
      action: 'settings.update',
      resource: 'settings',
      actor: userId,
      status: 'success',
      metadata: { change: 'create', settingId: saved.id },
      source: 'settings',
    })
    return saved
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
    const saved = await this.settingsRepository.save(setting)
    await this.auditLogs?.create({
      organizationId,
      action: 'settings.update',
      resource: 'settings',
      actor: userId,
      status: 'success',
      metadata: { change: 'update', settingId: saved.id },
      source: 'settings',
    })
    return saved
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
