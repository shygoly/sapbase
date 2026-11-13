import { Validator } from 'jsonschema'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolveRepoRoot } from '@sap/platform-core/common/repo-root'
import { loadSchema } from './schema-loader'

const ROOT = join(resolveRepoRoot(), 'fixtures', 'schemas')

const CASES: Array<{ dir: string; schema: string; valid: boolean }> = [
  { dir: 'agent-runtime', schema: 'agent-runtime.schema.json', valid: true },
  { dir: 'agent-runtime', schema: 'agent-runtime.schema.json', valid: false },
  { dir: 'model-gateway', schema: 'model-gateway.schema.json', valid: true },
  { dir: 'model-gateway', schema: 'model-gateway.schema.json', valid: false },
  { dir: 'space-delta', schema: 'space-delta.schema.json', valid: true },
  { dir: 'space-delta', schema: 'space-delta.schema.json', valid: false },
  {
    dir: 'business-app-installation',
    schema: 'business-app-installation.schema.json',
    valid: true,
  },
  {
    dir: 'business-app-installation',
    schema: 'business-app-installation.schema.json',
    valid: false,
  },
]

function fixtures(dir: string, valid: boolean): string[] {
  return readdirSync(join(ROOT, dir))
    .filter((file) => file.endsWith('.json'))
    .filter((file) => file.startsWith(valid ? 'valid-' : 'invalid-'))
    .sort()
}

describe('schema fixtures (1.5)', () => {
  for (const testCase of CASES) {
    const files = fixtures(testCase.dir, testCase.valid)
    it(`${testCase.dir} ${testCase.valid ? 'positive' : 'negative'} fixtures: ${files.length}`, () => {
      expect(files.length).toBeGreaterThan(0)
      const schema = loadSchema(testCase.schema)
      const validator = new Validator()
      for (const file of files) {
        const payload = JSON.parse(readFileSync(join(ROOT, testCase.dir, file), 'utf8'))
        const result = validator.validate(payload, schema)
        if (testCase.valid) {
          expect({ file, errors: result.errors }).toEqual({ file, errors: [] })
        } else {
          expect({ file, invalid: result.errors.length > 0 }).toEqual({
            file,
            invalid: true,
          })
        }
      }
    })
  }
})
