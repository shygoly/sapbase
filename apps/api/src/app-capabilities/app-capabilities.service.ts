import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { BusinessAppsService } from '../business-apps/business-apps.service'
import { AppCapability } from './entities/app-capability.entity'

const CAPABILITY_NAME = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/
const APP_KEY = /^[a-z][a-z0-9-]*$/
const FIELD = /^[a-z][A-Za-z0-9]*$/
const ENTITY = /^[A-Z][A-Za-z0-9]*$/

export interface PublishCapabilityInput {
  organizationId: string
  publisherAppKey: string
  name: string
  entity: string
  fields: string[]
  permission: string
  ownerField?: string | null
  readAllPermission?: string | null
  actor: string
  actorId?: string
}

export interface InvokeCapabilityInput {
  organizationId: string
  consumerInstallationId: string
  publisherAppKey?: string
  name: string
  userId: string
  permissions: readonly string[]
  limit?: number
}

@Injectable()
export class AppCapabilitiesService {
  constructor(
    @InjectRepository(AppCapability)
    private readonly capabilities: Repository<AppCapability>,
    private readonly apps: BusinessAppsService,
    private readonly audit: AuditLogsService,
  ) {}

  async publish(input: PublishCapabilityInput): Promise<AppCapability> {
    this.assertAppKey(input.publisherAppKey)
    if (!CAPABILITY_NAME.test(input.name)) {
      throw new BadRequestException(
        'capability 名称必须是 namespace.action（如 customer.lookup）',
      )
    }
    if (!ENTITY.test(input.entity)) {
      throw new BadRequestException('entity 必须是大写开头的实体名')
    }
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      throw new BadRequestException('fields 必须是非空数组')
    }
    for (const field of input.fields) {
      if (!FIELD.test(field)) {
        throw new BadRequestException(`非法投影字段：${field}`)
      }
    }
    if (!input.permission || input.permission.length > 128) {
      throw new BadRequestException('permission 必填且不超过 128 字符')
    }
    if (input.ownerField && !FIELD.test(input.ownerField)) {
      throw new BadRequestException(`非法 ownerField：${input.ownerField}`)
    }

    let capability = await this.capabilities.findOne({
      where: {
        organizationId: input.organizationId,
        publisherAppKey: input.publisherAppKey,
        name: input.name,
      },
    })
    if (!capability) {
      capability = this.capabilities.create({
        organizationId: input.organizationId,
        publisherAppKey: input.publisherAppKey,
        name: input.name,
        entity: input.entity,
        fields: [...new Set(input.fields)],
        permission: input.permission,
        ownerField: input.ownerField ?? null,
        readAllPermission: input.readAllPermission ?? null,
        status: 'active',
        version: 1,
        createdById: input.actorId ?? null,
      })
    } else {
      capability.entity = input.entity
      capability.fields = [...new Set(input.fields)]
      capability.permission = input.permission
      capability.ownerField = input.ownerField ?? null
      capability.readAllPermission = input.readAllPermission ?? null
      capability.status = 'active'
      capability.version += 1
    }
    const saved = await this.capabilities.save(capability)
    await this.audit.create({
      organizationId: input.organizationId,
      action: 'app_capability.published',
      resource: 'app_capability',
      resourceId: saved.id,
      actor: input.actor,
      status: 'success',
      metadata: {
        publisherAppKey: saved.publisherAppKey,
        name: saved.name,
        entity: saved.entity,
        fields: saved.fields,
        version: saved.version,
      },
      source: 'app-capabilities',
    })
    return saved
  }

  async list(organizationId: string, publisherAppKey?: string): Promise<AppCapability[]> {
    return this.capabilities.find({
      where: publisherAppKey
        ? { organizationId, publisherAppKey }
        : { organizationId },
      order: { publisherAppKey: 'ASC', name: 'ASC' },
    })
  }

  async invoke(input: InvokeCapabilityInput) {
    const consumer = await this.apps.resolveActiveForOrganization(
      input.consumerInstallationId,
      input.organizationId,
    )
    const capability = await this.findCapability(
      input.organizationId,
      input.name,
      input.publisherAppKey,
    )
    if (capability.status !== 'active') {
      throw new NotFoundException('能力未发布或已停用')
    }
    const installations = await this.apps.listForOrganization(input.organizationId)
    const publisher = installations.find(
      (installation) =>
        installation.appKey === capability.publisherAppKey &&
        installation.status === 'active',
    )
    if (!publisher) {
      throw new NotFoundException(
        `发布方应用 ${capability.publisherAppKey} 未安装或未激活`,
      )
    }
    if (publisher.id === consumer.id) {
      throw new ForbiddenException('不能通过跨应用能力读取自身应用数据')
    }
    const permissions = new Set(input.permissions)
    if (
      !permissions.has('*') &&
      !permissions.has('system:manage') &&
      !permissions.has(capability.permission)
    ) {
      throw new ForbiddenException(`缺少能力权限：${capability.permission}`)
    }

    const limit = Math.max(
      1,
      Math.min(200, Number.isFinite(input.limit) ? Number(input.limit) : 50),
    )
    const params: unknown[] = [
      input.organizationId,
      publisher.blueprintId,
      capability.entity,
    ]
    let sql = `SELECT id, data, state, "createdAt", "updatedAt"
                 FROM public.blueprint_records
                WHERE "organizationId" = $1
                  AND "blueprintId" = $2
                  AND entity = $3
                  AND "archivedAt" IS NULL`
    if (capability.ownerField) {
      const readAll =
        capability.readAllPermission !== null &&
        (permissions.has('*') ||
          permissions.has('system:manage') ||
          permissions.has(capability.readAllPermission))
      if (!readAll) {
        params.push(capability.ownerField, input.userId)
        sql += ` AND data->>$4 = $5`
      }
    }
    params.push(limit)
    sql += ` ORDER BY "createdAt" DESC LIMIT $${params.length}`
    const rows = (await this.capabilities.manager.query(sql, params)) as Array<{
      id: string
      data: Record<string, unknown>
      state: string
      createdAt: Date
      updatedAt: Date
    }>
    return {
      capability: {
        name: capability.name,
        version: capability.version,
        publisherAppKey: capability.publisherAppKey,
        entity: capability.entity,
        fields: capability.fields,
        permission: capability.permission,
      },
      consumer: {
        installationId: consumer.id,
        appKey: consumer.appKey,
      },
      publisher: {
        installationId: publisher.id,
        appKey: publisher.appKey,
        blueprintId: publisher.blueprintId,
        blueprintVersion: publisher.blueprintVersion,
      },
      records: rows.map((row) => {
        const projected: Record<string, unknown> = {
          id: row.id,
          state: row.state,
        }
        for (const field of capability.fields) {
          projected[field] = row.data?.[field] ?? null
        }
        return projected
      }),
    }
  }

  private async findCapability(
    organizationId: string,
    name: string,
    publisherAppKey?: string,
  ): Promise<AppCapability> {
    const matches = await this.capabilities.find({
      where: publisherAppKey
        ? { organizationId, publisherAppKey, name }
        : { organizationId, name },
    })
    if (matches.length === 0) throw new NotFoundException('能力不存在')
    if (matches.length > 1) {
      throw new BadRequestException(
        '多个应用发布了同名能力；请指定 publisherAppKey',
      )
    }
    return matches[0]
  }

  private assertAppKey(appKey: string): void {
    if (!appKey || !APP_KEY.test(appKey)) {
      throw new BadRequestException('publisherAppKey 非法')
    }
  }
}
