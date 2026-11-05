import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AIModuleBlueprintService } from './ai-module-blueprint.service'
import { BlueprintService } from '../blueprint/blueprint.service'

const layers = {
  semantic: {
    entities: [
      {
        name: 'Ticket',
        fields: [{ name: 'title', type: 'text' }],
        states: [
          { name: 'draft', initial: true },
          { name: 'closed', final: true },
        ],
        transitions: [{ from: 'draft', to: 'closed' }],
      },
    ],
  },
  flows: { flows: [] },
}

describe('AIModuleBlueprintService', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'ai-bp-service-'))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('writes a staging directory, packages it, and compiles it', async () => {
    let stagedDir = ''
    let stagedHasSemantic = false
    const blueprints = {
      packagesDirectory: () => workDir,
      packageFrom: jest.fn((dir: string) => {
        stagedDir = dir
        stagedHasSemantic = existsSync(join(dir, 'semantic.json'))
        return {
          packagePath: join(workDir, 'ticket-1.0.0.erpkg'),
          manifest: { blueprint: 'ticket', version: '1.0.0' },
        }
      }),
      compile: jest.fn(async () => ({ irDigest: `sha256:${'a'.repeat(64)}` })),
    }
    const service = new AIModuleBlueprintService(blueprints as never)

    const result = await service.materialize({
      name: 'Ticket',
      version: '1.0.0',
      layers,
    })

    expect(result.packageId).toBe('ticket-1.0.0')
    expect(blueprints.compile).toHaveBeenCalledWith('ticket-1.0.0', { stamp: true })
    expect(stagedHasSemantic).toBe(true)
    expect(existsSync(stagedDir)).toBe(false)
  })

  it('removes the half-written package when compilation fails', async () => {
    const packagePath = join(workDir, 'ticket-1.0.0.erpkg')
    const blueprints = {
      packagesDirectory: () => workDir,
      packageFrom: jest.fn(() => {
        writeFileSync(packagePath, 'partial')
        return { packagePath, manifest: { blueprint: 'ticket', version: '1.0.0' } }
      }),
      compile: jest.fn(async () => {
        throw new Error('atomic dependency unresolved')
      }),
    }
    const service = new AIModuleBlueprintService(blueprints as never)

    await expect(
      service.materialize({ name: 'Ticket', version: '1.0.0', layers }),
    ).rejects.toThrow('atomic dependency unresolved')
    expect(existsSync(packagePath)).toBe(false)
  })

  it('produces a real, stamped .erpkg through BlueprintService', async () => {
    const packagesDir = mkdtempSync(join(tmpdir(), 'ai-bp-packages-'))
    const saved = process.env.BLUEPRINT_PACKAGES_DIR
    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    try {
      const blueprints = new BlueprintService({ resolve: async () => ({}) } as never)
      const service = new AIModuleBlueprintService(blueprints)
      const result = await service.materialize({ name: 'Ticket', version: '1.0.0', layers })

      expect(existsSync(result.packagePath)).toBe(true)
      const manifest = blueprints.manifestOf(result.packageId)
      expect(manifest.compiled?.irDigest).toBe(result.irDigest)
    } finally {
      if (saved === undefined) delete process.env.BLUEPRINT_PACKAGES_DIR
      else process.env.BLUEPRINT_PACKAGES_DIR = saved
      rmSync(packagesDir, { recursive: true, force: true })
    }
  })

  it('rejects an invalid blueprint identity before writing', async () => {
    const blueprints = {
      packagesDirectory: () => workDir,
      packageFrom: jest.fn(),
      compile: jest.fn(),
    }
    const service = new AIModuleBlueprintService(blueprints as never)
    await expect(
      service.materialize({ name: '***', version: '1.0.0', layers }),
    ).rejects.toThrow()
    expect(blueprints.packageFrom).not.toHaveBeenCalled()
  })
})
