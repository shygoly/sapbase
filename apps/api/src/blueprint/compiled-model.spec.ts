import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBlueprint } from './loader'
import { BLUEPRINT_META_FILE, packBlueprint } from './packager'

const UNSIGNED = { allowUnsigned: true as const }
const moduleSha = 'b'.repeat(64)

const registry = {
  resolve: async () => ({
    contract: { version: '1.0.0' },
    implementation: { kind: 'wasm', moduleSha256: moduleSha, tier: 'B' },
  }),
} as never

function writeSourceDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bp-compiled-'))
  writeFileSync(
    join(dir, BLUEPRINT_META_FILE),
    JSON.stringify({
      blueprint: 'compiled-demo',
      version: '1.0.0',
      runtime: '>=1.0.0 <2.0.0',
      dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
    }),
  )
  writeFileSync(
    join(dir, 'semantic.json'),
    JSON.stringify({
      entities: [
        {
          name: 'Order',
          fields: [
            { name: 'code', type: 'text', unique: true, indexed: true },
            { name: 'status', type: 'text', indexed: true },
            { name: 'amount', type: 'decimal', indexed: true },
            { name: 'name', type: 'text', required: true },
            { name: 'memo', type: 'text' },
          ],
          states: [
            { name: 'draft', initial: true },
            { name: 'done', final: true },
          ],
          transitions: [{ from: 'draft', to: 'done' }],
        },
      ],
    }),
  )
  writeFileSync(
    join(dir, 'flows.json'),
    JSON.stringify({
      flows: [
        {
          id: 'OrderFlow',
          entity: 'Order',
          steps: [
            {
              id: 'done',
              on: 'done',
              actions: [{ kind: 'check', atomic: 'available-inventory@^1.0.0' }],
            },
          ],
        },
      ],
    }),
  )
  writeFileSync(
    join(dir, 'rules.json'),
    JSON.stringify({
      rules: 'blueprint-rules/v1',
      validation: [
        { id: 'amount-positive', entity: 'Order', field: 'amount', rule: 'greaterThan', value: 0, message: '金额必须大于 0' },
      ],
      approval: [],
      accounting: [],
    }),
  )
  return dir
}

describe('CompiledBlueprint', () => {
  let dir: string
  let pkg: string

  beforeEach(() => {
    dir = writeSourceDir()
    pkg = join(dir, 'compiled-demo.erpkg')
    packBlueprint(dir, pkg)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('loads the runtime template from the compiled artifact', async () => {
    const loaded = await loadBlueprint(pkg, registry, UNSIGNED)

    expect(loaded.compiled.format).toBe('blueprint-runtime/v1')
    expect(loaded.compiled.irDigest).toBe(loaded.plan.irDigest)
    expect(loaded.compiled.template.entities.map((entity) => entity.name)).toEqual(['Order'])
    expect(loaded.compiled.template.validation.map((rule) => rule.id)).toEqual(['amount-positive'])
    expect(loaded.compiled.template.approval).toEqual([])
    expect(loaded.compiled.template.accounting).toEqual([])
  })

  it('plans unique, not-null and explicit query indexes', async () => {
    const loaded = await loadBlueprint(pkg, registry, UNSIGNED)
    const plan = loaded.compiled.indexPlan

    expect(plan).toEqual(
      expect.arrayContaining([
        { entity: 'Order', field: 'code', kind: 'unique', sqlType: 'text' },
        { entity: 'Order', field: 'code', kind: 'query', sqlType: 'text' },
        { entity: 'Order', field: 'status', kind: 'query', sqlType: 'text' },
        { entity: 'Order', field: 'amount', kind: 'query', sqlType: 'numeric' },
        { entity: 'Order', field: 'name', kind: 'not-null', sqlType: 'text' },
      ]),
    )
    expect(plan).not.toEqual(
      expect.arrayContaining([{ entity: 'Order', field: 'memo' }]),
    )
  })
})
