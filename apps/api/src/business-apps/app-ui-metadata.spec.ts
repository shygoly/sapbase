import { Validator } from 'jsonschema'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadSchema } from '../common/protocol/schema-loader'
import { resolveRepoRoot } from '@sap/platform-core/common/repo-root'

describe('ERP application UI metadata', () => {
  const ui = JSON.parse(
    readFileSync(join(resolveRepoRoot(), 'templates/auto-parts/ui.json'), 'utf8'),
  ) as {
    ui: string
    pages: Array<{ identifier: string; entity: string; route?: string }>
    menus: Array<{ identifier: string; path: string; permissions?: string[] }>
  }

  it('通过 blueprint-ui schema 校验', () => {
    const result = new Validator().validate(ui, loadSchema('blueprint-ui.schema.json'))
    expect(result.errors).toEqual([])
  })

  it('ERP 菜单声明 shipping 路由，不再依赖 shell 硬编码', () => {
    const paths = ui.menus.map((menu) => menu.path)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dashboard/shipping/ships',
        '/dashboard/shipping/voyages',
        '/dashboard/shipping/charters',
        '/dashboard/shipping/report-center',
      ]),
    )
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dashboard/auto-parts/parts',
        '/dashboard/auto-parts/suppliers',
        '/dashboard/auto-parts/customers',
        '/dashboard/auto-parts/sales-orders',
        '/dashboard/auto-parts/stock',
      ]),
    )
    for (const menu of ui.menus) {
      expect(menu.identifier.length).toBeGreaterThan(0)
    }
  })

  it('每个 ERP 页面声明实体与路由', () => {
    expect(ui.ui).toBe('blueprint-ui/v1')
    expect(ui.pages.length).toBeGreaterThanOrEqual(5)
    for (const page of ui.pages) {
      expect(page.identifier).toMatch(/^[A-Z][A-Za-z0-9]*$/)
      expect(page.entity).toMatch(/^[A-Z][A-Za-z0-9]*$/)
      expect(page.route?.startsWith('/dashboard/')).toBe(true)
    }
  })
})
