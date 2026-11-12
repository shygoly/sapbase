/**
 * CRM 应用模板：打包 → 编译通过 → UI 元数据可被应用导航解析。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { compileBlueprint } from './compiler'
import { packBlueprint, unpackBlueprint } from './packager'
import { loadBlueprint } from './loader'

const TEMPLATE_DIR = resolve(__dirname, '../../../../templates/crm')

const registry = {
  resolve: async () => ({ contract: { version: '1.0.0' } }),
} as never

describe('templates/crm', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'crm-'))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('打包 → 编译通过 → irDigest 稳定', async () => {
    const pkg = join(workDir, 'crm-1.0.0.erpkg')
    const manifest = packBlueprint(TEMPLATE_DIR, pkg)
    expect(manifest.blueprint).toBe('crm')
    expect(manifest.version).toBe('1.0.0')

    const first = await compileBlueprint(unpackBlueprint(pkg), registry)
    const second = await compileBlueprint(unpackBlueprint(pkg), registry)
    expect(first.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(second.irDigest).toBe(first.irDigest)
    expect(first.ir.entities.map((entity) => entity.name)).toEqual([
      'Customer',
      'Contact',
      'Lead',
      'Opportunity',
      'Activity',
    ])
  })

  it('CRM UI 声明独立菜单/路由，不依赖 shell 硬编码', async () => {
    const pkg = join(workDir, 'crm-1.0.0.erpkg')
    packBlueprint(TEMPLATE_DIR, pkg)
    const loaded = await loadBlueprint(pkg, registry, { allowUnsigned: true })
    expect(loaded.compiled.ui).toMatchObject({ ui: 'blueprint-ui/v1' })
    const menus = loaded.compiled.ui?.menus ?? []
    expect(menus.map((menu) => menu.path)).toEqual([
      '/dashboard/crm/customers',
      '/dashboard/crm/contacts',
      '/dashboard/crm/leads',
      '/dashboard/crm/opportunities',
      '/dashboard/crm/activities',
    ])
    expect(loaded.compiled.ui?.pages).toHaveLength(8)
    for (const page of loaded.compiled.ui?.pages ?? []) {
      expect(page.entity).toBeTruthy()
      expect(page.route?.startsWith('/dashboard/crm/')).toBe(true)
    }
  })
})
