import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Plugin as PluginOrm } from './plugin.entity'
import { Plugin, PluginStatus } from '../../domain/entities/plugin.entity'
import type { IPluginRepository } from '../../domain/repositories'

@Injectable()
export class PluginRepository implements IPluginRepository {
  constructor(
    @InjectRepository(PluginOrm)
    private readonly repo: Repository<PluginOrm>,
  ) {}

  async findById(id: string, organizationId: string): Promise<Plugin | null> {
    const row = await this.repo.findOne({
      where: { id, organizationId },
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async findByName(
    name: string,
    organizationId: string,
  ): Promise<Plugin | null> {
    const row = await this.repo.findOne({
      where: { name, organizationId },
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async findAll(organizationId: string): Promise<Plugin[]> {
    const rows = await this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
    return rows.map((row) => this.toDomain(row))
  }

  async save(plugin: Plugin): Promise<void> {
    const existing = await this.repo.findOne({
      where: { id: plugin.id, organizationId: plugin.organizationId },
    })

    const orm = existing || new PluginOrm()
    orm.id = plugin.id
    orm.organizationId = plugin.organizationId
    orm.name = plugin.name
    orm.version = plugin.version
    orm.type = plugin.type
    orm.manifest = plugin.manifest
    orm.status = plugin.status
    orm.installPath = plugin.installPath
    orm.updatedAt = plugin.updatedAt

    await this.repo.save(orm)
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.repo.delete({ id, organizationId })
  }

  private toDomain(row: PluginOrm): Plugin {
    return Plugin.fromPersistence(
      row.id,
      row.organizationId,
      row.manifest,
      row.status as PluginStatus,
      row.installPath,
      row.createdAt,
      row.updatedAt,
    )
  }
}
