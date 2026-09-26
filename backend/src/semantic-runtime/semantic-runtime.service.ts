import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { join } from 'node:path'
import { BlueprintService } from '../blueprint/blueprint.service'
import { LoadError } from '../blueprint/loader'
import { CompileError } from '../blueprint/compiler'
import { PackageError, unpackBlueprint } from '../blueprint/packager'
import { BlueprintRecord } from './blueprint-record.entity'
import {
  validateRecord,
  type SemanticEntity,
  type ValidationRule,
} from './record-validator'

export class RecordWriteError extends Error {
  constructor(
    message: string,
    readonly reason: string,
    readonly field?: string,
    readonly ruleId?: string,
  ) {
    super(message)
    this.name = 'RecordWriteError'
  }
}

interface SemanticFile {
  entities: SemanticEntity[]
}

interface RulesFile {
  validation: ValidationRule[]
}

/**
 * 写入链（顺序固定，任一不过即拒、不落库）：
 *   1. 装载模板（复用 loadBlueprint，授权门自动生效）
 *   2–6. validateRecord
 *   7. 落库
 */
@Injectable()
export class SemanticRuntimeService {
  constructor(
    private readonly blueprints: BlueprintService,
    @InjectRepository(BlueprintRecord)
    private readonly records: Repository<BlueprintRecord>,
  ) {}

  async write(
    packageId: string,
    entity: string,
    data: Record<string, unknown>,
    organizationId: string,
  ): Promise<BlueprintRecord> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝写入', 'missing-tenant')
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new RecordWriteError('记录体必须是对象', 'type-mismatch')
    }

    const loaded = await this.loadOrThrow(packageId, organizationId)
    const { entities, validation } = this.readTemplate(packageId)
    const existingRefs = await this.collectRefs(loaded.manifest.blueprint, organizationId, entities, data)

    const checked = validateRecord({
      entities,
      validation,
      entity,
      data,
      existingRefs,
    })
    if (!checked.ok) {
      throw new RecordWriteError(checked.detail, checked.reason, checked.field, checked.ruleId)
    }

    const row = this.records.create({
      blueprintId: loaded.manifest.blueprint,
      blueprintVersion: loaded.manifest.version,
      entity,
      organizationId,
      data,
    })
    return this.records.save(row)
  }

  async list(packageId: string, entity: string, organizationId: string): Promise<BlueprintRecord[]> {
    if (!organizationId) {
      throw new RecordWriteError('缺少 organizationId，拒绝读取', 'missing-tenant')
    }
    const loaded = await this.loadOrThrow(packageId, organizationId)
    return this.records.find({
      where: {
        blueprintId: loaded.manifest.blueprint,
        entity,
        organizationId,
      },
      order: { createdAt: 'ASC' },
    })
  }

  private async loadOrThrow(packageId: string, organizationId: string) {
    try {
      return await this.blueprints.load(packageId, { tenantId: organizationId })
    } catch (error) {
      if (
        error instanceof LoadError ||
        error instanceof CompileError ||
        error instanceof PackageError ||
        error instanceof NotFoundException
      ) {
        throw error
      }
      throw error
    }
  }

  private readTemplate(packageId: string): { entities: SemanticEntity[]; validation: ValidationRule[] } {
    const path = join(this.blueprints.packagesDirectory(), `${packageId}.erpkg`)
    const unpacked = unpackBlueprint(path)
    const semanticBytes = unpacked.files.get('semantic.json')
    if (!semanticBytes) {
      throw new RecordWriteError('包内缺少 semantic.json', 'unknown-entity')
    }
    const semantic = JSON.parse(semanticBytes.toString('utf8')) as SemanticFile
    const rulesBytes = unpacked.files.get('rules.json')
    const rules = rulesBytes
      ? (JSON.parse(rulesBytes.toString('utf8')) as RulesFile)
      : { validation: [] }
    return { entities: semantic.entities, validation: rules.validation ?? [] }
  }

  /** 只查本条记录引用到的目标，避免把整张表载进内存。 */
  private async collectRefs(
    blueprintId: string,
    organizationId: string,
    entities: SemanticEntity[],
    data: Record<string, unknown>,
  ): Promise<Set<string>> {
    const needed = new Map<string, string[]>()
    for (const entity of entities) {
      for (const field of entity.fields) {
        if (field.type !== 'reference' || !field.reference) continue
        const value = data[field.name]
        if (typeof value !== 'string' || value.length === 0) continue
        const list = needed.get(field.reference) ?? []
        list.push(value)
        needed.set(field.reference, list)
      }
    }

    const found = new Set<string>()
    for (const [targetEntity, ids] of needed) {
      if (ids.length === 0) continue
      const rows = await this.records.find({
        where: {
          blueprintId,
          entity: targetEntity,
          organizationId,
          id: In(ids),
        },
        select: ['id', 'entity'],
      })
      for (const row of rows) {
        found.add(`${row.entity}:${row.id}`)
      }
    }
    return found
  }
}

export function toHttpException(error: unknown): never {
  if (error instanceof RecordWriteError) {
    throw new BadRequestException({
      message: error.message,
      reason: error.reason,
      field: error.field,
      ruleId: error.ruleId,
    })
  }
  if (error instanceof LoadError) {
    throw new BadRequestException({ message: error.message, reason: error.reason })
  }
  if (error instanceof CompileError) {
    throw new BadRequestException({
      message: error.message,
      reason: error.reason,
      conflicts: error.conflicts,
    })
  }
  if (error instanceof PackageError) {
    throw new BadRequestException({ message: error.message, reason: error.reason })
  }
  throw error
}
