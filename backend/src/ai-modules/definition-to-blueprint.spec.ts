import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileBlueprint } from '../blueprint/compiler'
import { packBlueprint, unpackBlueprint } from '../blueprint/packager'
import {
  DefinitionToBlueprintError,
  definitionToBlueprint,
  writeBlueprintDir,
} from './definition-to-blueprint'

/** 六步真实键：objectModel / relationships / stateFlow / pages / permissions / reports。 */
function completeMerged(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    objectModel: {
      entities: [
        {
          identifier: 'Ticket',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'priority', type: 'number' },
          ],
        },
      ],
    },
    relationships: { relationships: [] },
    stateFlow: {
      states: [
        { name: 'draft', initial: true },
        { name: 'open' },
        { name: 'closed', final: true },
      ],
      transitions: [
        { from: 'draft', to: 'open', action: 'available-inventory' },
        { from: 'open', to: 'closed' },
      ],
    },
    pages: { pages: [] },
    permissions: { rules: [{ role: 'agent', scope: 'own', resources: ['Ticket'] }] },
    reports: { reports: [] },
    ...overrides,
  }
}

describe('definitionToBlueprint（纯函数）', () => {
  it('正例：完整 mergedDefinition → semantic + flows，权限/页面不编成 rules', () => {
    const layers = definitionToBlueprint(completeMerged())
    expect(layers.semantic.entities).toHaveLength(1)
    expect(layers.semantic.entities[0]).toEqual(
      expect.objectContaining({
        name: 'Ticket',
        fields: expect.arrayContaining([
          expect.objectContaining({ name: 'title', type: 'text', required: true }),
          expect.objectContaining({ name: 'priority', type: 'number' }),
        ]),
      }),
    )
    expect(layers.semantic.entities[0].states.filter((state) => state.initial)).toHaveLength(1)
    expect(layers.semantic.entities[0].states.some((state) => state.final)).toBe(true)
    expect(layers.flows.flows).toHaveLength(1)
    expect(layers.flows.flows[0].steps.every((step) => step.actions.length >= 1)).toBe(true)
    expect(layers.flows.flows[0].steps.every((step) => /^[a-z]/.test(step.on))).toBe(true)
    expect(layers.rules).toBeUndefined()
    expect(layers.experience).toBeUndefined()
  })

  it('负例：缺 rules → 不含 rules 层（permissions 不是规则层）', () => {
    const layers = definitionToBlueprint(completeMerged())
    expect(layers.rules).toBeUndefined()
    const dir = mkdtempSync(join(tmpdir(), 'ai-bp-norules-'))
    try {
      writeBlueprintDir(dir, layers, {
        blueprint: 'ai-ticket',
        version: '1.0.0',
        runtime: '>=1.0.0 <2.0.0',
      })
      expect(() => readFileSync(join(dir, 'rules.json'))).toThrow()
      expect(readFileSync(join(dir, 'semantic.json'), 'utf8')).toContain('Ticket')
      expect(readFileSync(join(dir, 'flows.json'), 'utf8')).toContain('TicketFlow')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('负例：非法实体名报错，不硬塞', () => {
    expect(() =>
      definitionToBlueprint(
        completeMerged({
          objectModel: {
            entities: [{ identifier: 'bad-name!', fields: [{ name: 'title', type: 'string' }] }],
          },
        }),
      ),
    ).toThrow(DefinitionToBlueprintError)
    expect(() =>
      definitionToBlueprint(
        completeMerged({
          objectModel: {
            entities: [{ identifier: '订单', fields: [{ name: 'title', type: 'string' }] }],
          },
        }),
      ),
    ).toThrow(DefinitionToBlueprintError)
  })

  it('源里真有 blueprint-rules/v1 才产出 rules 层', () => {
    const layers = definitionToBlueprint(
      completeMerged({
        rules: {
          rules: 'blueprint-rules/v1',
          validation: [
            {
              id: 'ticket-title-required',
              entity: 'Ticket',
              field: 'title',
              rule: 'required',
              message: '标题必填',
            },
          ],
          approval: [],
          accounting: [],
        },
      }),
    )
    expect(layers.rules?.rules).toBe('blueprint-rules/v1')
    expect(layers.rules?.validation).toHaveLength(1)
  })

  it('产出可走既有 pack + compile（不新开打包路径）', async () => {
    const layers = definitionToBlueprint(completeMerged())
    const dir = mkdtempSync(join(tmpdir(), 'ai-bp-pack-'))
    try {
      writeBlueprintDir(dir, layers, {
        blueprint: 'ai-ticket',
        version: '1.0.0',
        runtime: '>=1.0.0 <2.0.0',
      })
      const pkg = join(dir, 'ai-ticket-1.0.0.erpkg')
      packBlueprint(dir, pkg)
      const compiled = await compileBlueprint(unpackBlueprint(pkg), {
        resolve: async () => ({ contract: { version: '1.0.0' } }),
      } as never)
      expect(compiled.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
      expect(unpackBlueprint(pkg).manifest.files['rules.json']).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
