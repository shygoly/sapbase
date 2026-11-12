import { BadRequestException, Injectable } from '@nestjs/common'
import type {
  AdapterContext,
  ExportAdapter,
  ImportAdapter,
  ResourceDescriptor,
} from './bulk.types'

const RESOURCE_KEY = /^[a-z][a-z0-9-]*:[a-zA-Z0-9._:-]+$/

/**
 * 资源适配器注册表。资源键必须带命名空间（`platform:users`、
 * `blueprint:<packageId>:<entity>`），未知键一律拒绝，避免"任意表可导出"。
 */
@Injectable()
export class BulkAdapterRegistry {
  private readonly importers: ImportAdapter[] = []
  private readonly exporters: ExportAdapter[] = []

  registerImport(adapter: ImportAdapter): void {
    if (this.importers.some((item) => item.namespace === adapter.namespace)) {
      throw new Error(`导入适配器命名空间重复：${adapter.namespace}`)
    }
    this.importers.push(adapter)
  }

  registerExport(adapter: ExportAdapter): void {
    if (this.exporters.some((item) => item.namespace === adapter.namespace)) {
      throw new Error(`导出适配器命名空间重复：${adapter.namespace}`)
    }
    this.exporters.push(adapter)
  }

  assertResourceKey(resourceKey: string): string {
    if (!RESOURCE_KEY.test(resourceKey)) {
      throw new BadRequestException(`非法资源键：${resourceKey}`)
    }
    return resourceKey
  }

  importAdapter(resourceKey: string): ImportAdapter {
    const key = this.assertResourceKey(resourceKey)
    const adapter = this.importers.find((item) => item.supports(key))
    if (!adapter) throw new BadRequestException(`未注册的导入资源：${key}`)
    return adapter
  }

  exportAdapter(resourceKey: string): ExportAdapter {
    const key = this.assertResourceKey(resourceKey)
    const adapter = this.exporters.find((item) => item.supports(key))
    if (!adapter) throw new BadRequestException(`未注册的导出资源：${key}`)
    return adapter
  }

  async describeImport(ctx: AdapterContext): Promise<ResourceDescriptor> {
    return this.importAdapter(ctx.resourceKey).describe(ctx)
  }

  async describeExport(ctx: AdapterContext): Promise<ResourceDescriptor> {
    return this.exportAdapter(ctx.resourceKey).describe(ctx)
  }

  async listResources(ctx: AdapterContext): Promise<ResourceDescriptor[]> {
    const seen = new Map<string, ResourceDescriptor>()
    for (const adapter of this.importers) {
      for (const item of (await adapter.listResources?.(ctx)) ?? []) {
        seen.set(item.resourceKey, { ...item, canImport: true })
      }
    }
    for (const adapter of this.exporters) {
      for (const item of (await adapter.listResources?.(ctx)) ?? []) {
        const existing = seen.get(item.resourceKey)
        seen.set(item.resourceKey, {
          ...(existing ?? item),
          canExport: true,
        })
      }
    }
    return [...seen.values()]
  }
}
