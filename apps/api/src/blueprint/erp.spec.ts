/**
 * ERP 发布方模板：Customer 投影能力的来源应用。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { compileBlueprint } from './compiler'
import { loadBlueprint } from './loader'
import { packBlueprint, unpackBlueprint } from './packager'

const TEMPLATE_DIR = resolve(__dirname, '../../../../templates/erp')
const registry = {
  resolve: async () => ({ contract: { version: '1.0.0' } }),
} as never

describe('templates/erp', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'erp-'))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('打包/编译/导航元数据可用', async () => {
    const pkg = join(workDir, 'erp-1.0.0.erpkg')
    const manifest = packBlueprint(TEMPLATE_DIR, pkg)
    expect(manifest).toMatchObject({ blueprint: 'erp', version: '1.0.0' })
    const compiled = await compileBlueprint(unpackBlueprint(pkg), registry)
    expect(compiled.ir.entities.map((entity) => entity.name)).toEqual([
      'Customer',
      'SalesOrder',
    ])
    const loaded = await loadBlueprint(pkg, registry, { allowUnsigned: true })
    expect(loaded.compiled.ui?.menus?.map((menu) => menu.path)).toEqual([
      '/dashboard/erp/customers',
      '/dashboard/erp/sales-orders',
    ])
  })
})
