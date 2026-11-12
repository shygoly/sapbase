import { BadRequestException } from '@nestjs/common'
import { BulkAdapterRegistry } from './bulk.registry'
import type { ExportAdapter, ImportAdapter, ResourceDescriptor } from './bulk.types'

const descriptor: ResourceDescriptor = {
  resourceKey: 'fake:things',
  label: 'Things',
  canImport: true,
  canExport: true,
  fields: [{ key: 'name', label: 'name', type: 'string' }],
  importFormats: ['csv'],
  exportFormats: ['csv'],
}

function adapter(namespace: string, supports: string): ImportAdapter & ExportAdapter {
  return {
    namespace,
    supports: (key) => key === supports,
    async describe() {
      return { ...descriptor, resourceKey: supports }
    },
    async listResources() {
      return [{ ...descriptor, resourceKey: supports }]
    },
    async write() {
      return { imported: 0, validated: 0, errors: [] }
    },
    async exportPage() {
      return { rows: [], total: 0 }
    },
  }
}

describe('BulkAdapterRegistry', () => {
  it('按资源键选择适配器，未知资源拒绝', () => {
    const registry = new BulkAdapterRegistry()
    const fake = adapter('fake', 'fake:things')
    registry.registerImport(fake)
    registry.registerExport(fake)
    expect(registry.importAdapter('fake:things')).toBe(fake)
    expect(() => registry.importAdapter('fake:missing')).toThrow(BadRequestException)
    expect(() => registry.exportAdapter('other:things')).toThrow(/未注册/)
  })

  it('非法资源键（无命名空间）拒绝', () => {
    const registry = new BulkAdapterRegistry()
    expect(() => registry.importAdapter('users')).toThrow(/非法资源键/)
  })

  it('同命名空间重复注册拒绝', () => {
    const registry = new BulkAdapterRegistry()
    registry.registerImport(adapter('fake', 'fake:things'))
    expect(() => registry.registerImport(adapter('fake', 'fake:other'))).toThrow(/重复/)
  })

  it('资源列表合并导入/导出方向', async () => {
    const registry = new BulkAdapterRegistry()
    const importer = adapter('fake', 'fake:things')
    const exporter = { ...adapter('fake2', 'fake:things'), namespace: 'fake2' }
    registry.registerImport(importer)
    registry.registerExport(exporter)
    const resources = await registry.listResources({
      organizationId: 'org',
      actor: { id: 'u', permissions: [] },
      resourceKey: 'fake:things',
    })
    expect(resources).toHaveLength(1)
    expect(resources[0]).toMatchObject({ canImport: true, canExport: true })
  })
})
