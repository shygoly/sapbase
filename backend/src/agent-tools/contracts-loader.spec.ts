import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TOOL_PERMISSION_CATALOG } from './tool-permissions'
import {
  assertToolCatalog,
  clearContractsCache,
  loadToolCatalog,
} from './contracts-loader'

const READ_TOOL = {
  name: 'erp_blueprint_list',
  description: '当用户要查看蓝图包时使用',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  permission: 'tool:blueprint:read',
  write: false,
  confirmation: 'none',
}

afterEach(() => {
  clearContractsCache()
  delete process.env.SPECKIT_CONTRACTS_DIR
})

describe('契约加载（真文件）', () => {
  it('真实的 contracts/tools.json 能被加载且通过校验', () => {
    const catalog = loadToolCatalog()
    expect(catalog.version).toBe(1)
    expect(catalog.tools.map((tool) => tool.name)).toEqual([
      'erp_blueprint_list',
      'erp_blueprint_manifest',
      'erp_blueprint_compile',
      'erp_atomic_invoke',
      'erp_module_list',
      'erp_module_export',
    ])
    const compile = catalog.tools.find((tool) => tool.name === 'erp_blueprint_compile')
    expect(compile?.write).toBe(false)
    const exported = catalog.tools.find((tool) => tool.name === 'erp_module_export')
    expect(exported?.write).toBe(true)
    expect(exported?.confirmation).toBe('required')
  })

  it('每个工具声明的 permission ∈ TOOL_PERMISSION_CATALOG', () => {
    const catalog = loadToolCatalog()
    for (const tool of catalog.tools) {
      expect(TOOL_PERMISSION_CATALOG).toContain(tool.permission)
    }
  })
})

describe('契约加载（负例）', () => {
  it('声明了清单里没有的权限点 → 拒，且错误信息说出是哪个权限点', () => {
    expect(() =>
      assertToolCatalog({
        version: 1,
        tools: [{ ...READ_TOOL, permission: 'tool:unknown:zzz' }],
      }),
    ).toThrow(/tool:unknown:zzz/)
  })

  it("write: true + confirmation: 'none' → 拒（无人确认的写通道不合法）", () => {
    expect(() =>
      assertToolCatalog({
        version: 1,
        tools: [
          {
            ...READ_TOOL,
            name: 'erp_module_export',
            permission: 'tool:module:export',
            write: true,
            confirmation: 'none',
          },
        ],
      }),
    ).toThrow(/无人确认的写通道/)
  })

  it('工具重名 → 拒', () => {
    expect(() =>
      assertToolCatalog({ version: 1, tools: [READ_TOOL, READ_TOOL] }),
    ).toThrow(/工具名重复/)
  })

  it('allowedAgents 声明 → 拒（v1 没有智能体身份，判不了的字段不接受）', () => {
    expect(() =>
      assertToolCatalog({
        version: 1,
        tools: [{ ...READ_TOOL, allowedAgents: ['main'] }],
      }),
    ).toThrow(/allowedAgents/)
  })

  it('SPECKIT_CONTRACTS_DIR 指向非法契约时加载失败', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agent-tools-'))
    writeFileSync(
      join(dir, 'tools.json'),
      JSON.stringify({
        version: 1,
        tools: [{ ...READ_TOOL, permission: 'tool:not-in-catalog:x' }],
      }),
    )
    process.env.SPECKIT_CONTRACTS_DIR = dir
    expect(() => loadToolCatalog()).toThrow(/tool:not-in-catalog:x/)
  })
})
