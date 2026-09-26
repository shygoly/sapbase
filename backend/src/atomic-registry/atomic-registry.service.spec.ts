// 原子契约注册表 —— 正例 + 负例（backend/AGENTS.md：协议类逻辑必须带拒绝集）。
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildFixtureWasm } from '@speckit/wasm-modules'
import { AtomicRegistryService } from './atomic-registry.service'
import { AtomicContractStatus, AtomicKind } from './atomic-contract.entity'
import {
  AdmissionStatus,
  AtomicImplementationKind,
} from './atomic-implementation.entity'

/** 内存版 Repository：只实现 service 用到的四个方法，避免为了单测起数据库。 */
function fakeRepo(seed: Record<string, unknown>[] = []) {
  const rows: Record<string, unknown>[] = [...seed]
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v)

  return {
    rows,
    findOne: async ({ where }: { where: Record<string, unknown> }) =>
      rows.find((r) => match(r, where)) ?? null,
    find: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      where ? rows.filter((r) => match(r, where)) : [...rows],
    create: (data: Record<string, unknown>) => ({ ...data }),
    save: async (entity: Record<string, unknown>) => {
      if (!entity.id) {
        entity.id = `id-${rows.length + 1}`
        rows.push(entity)
      } else {
        const index = rows.findIndex((r) => r.id === entity.id)
        if (index >= 0) rows[index] = entity
        else rows.push(entity)
      }
      return entity
    },
  }
}

const HASH = '54c7674e402c268b7b3bf29cd2fb496557c836c7e82c95684db12147d13d8736'

/** 合法契约（与 contract-validator.spec 的夹具同形，独立维护避免测试互相耦合）。 */
function contract(overrides: Record<string, unknown> = {}) {
  return {
    atomicType: 'available-inventory',
    version: '1.0.0',
    kind: AtomicKind.CALCULATION,
    inputSchema: {
      rows: { source: '$lines' },
      columns: [{ name: 'onHand', source: '$line.onHand', type: 'i32' }],
    },
    outputSchema: { columns: [{ name: 'available', type: 'i32' }] },
    permissions: ['inventory.read'],
    ...overrides,
  }
}

function build() {
  const contracts = fakeRepo()
  const implementations = fakeRepo()
  const manifests = fakeRepo()
  const service = new AtomicRegistryService(
    contracts as never,
    implementations as never,
    manifests as never,
  )
  return { service, contracts, implementations, manifests }
}

/** 真实清单（wasm-modules 准入产出的 build/manifest.json）。 */
const REAL_MANIFEST = resolve(
  __dirname,
  '../../../wasm-modules/build/manifest.json',
)

const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex')

describe('AtomicRegistryService.createContract', () => {
  it('接受合法契约并落库', async () => {
    const { service, contracts } = build()
    const saved = await service.createContract(contract())
    expect(saved.atomicType).toBe('available-inventory')
    expect(saved.status).toBe(AtomicContractStatus.DRAFT)
    expect(contracts.rows).toHaveLength(1)
  })

  it('拒绝 v1 不允许的写入型原子，且不落库', async () => {
    const { service, contracts } = build()
    await expect(
      service.createContract(contract({ kind: 'command' })),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(contracts.rows).toHaveLength(0)
  })

  it('同一 atomicType + version 重复登记 → 冲突', async () => {
    const { service } = build()
    await service.createContract(contract())
    await expect(service.createContract(contract())).rejects.toBeInstanceOf(
      ConflictException,
    )
  })
})

describe('AtomicRegistryService.resolve', () => {
  const active = (version: string) =>
    contract({ version, status: AtomicContractStatus.ACTIVE })

  it('在语义化范围内选最高版本，并返回可执行实现', async () => {
    const { service, contracts, implementations } = build()
    await service.createContract(active('1.0.0'))
    await service.createContract(active('1.1.0'))
    await service.createContract(active('2.0.0'))
    const target = contracts.rows.find((c) => c.version === '1.1.0') as {
      id: string
    }
    implementations.rows.push({
      id: 'impl-1',
      atomicContractId: target.id,
      status: AdmissionStatus.ACTIVE,
    })

    const resolved = await service.resolve('available-inventory', '^1.0.0')
    expect(resolved.contract.version).toBe('1.1.0')
    expect(resolved.implementation.id).toBe('impl-1')
  })

  it('范围无解 → 404，且不回落任何内置实现', async () => {
    const { service } = build()
    await service.createContract(active('1.0.0'))
    await expect(
      service.resolve('available-inventory', '^3.0.0'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('跳过非 active 的契约（草稿不参与解析）', async () => {
    const { service } = build()
    await service.createContract(contract({ version: '1.0.0' })) // draft
    await expect(
      service.resolve('available-inventory', '^1.0.0'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('契约存在但没有可执行实现 → 404', async () => {
    const { service, implementations, contracts } = build()
    await service.createContract(active('1.0.0'))
    implementations.rows.push({
      id: 'impl-x',
      atomicContractId: (contracts.rows[0] as { id: string }).id,
      status: AdmissionStatus.REJECTED,
    })
    await expect(
      service.resolve('available-inventory', '^1.0.0'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('AtomicRegistryService.bindImplementation', () => {
  it('接受带完整证据的 Tier A Wasm 实现', async () => {
    const { service, contracts } = build()
    const saved = await service.createContract(contract())
    const impl = await service.bindImplementation(saved.id, {
      kind: AtomicImplementationKind.WASM,
      moduleSha256: HASH,
      abiVersion: 1,
      tier: 'A' as never,
    })
    expect(impl.moduleSha256).toBe(HASH)
    expect(impl.status).toBe(AdmissionStatus.SUBMITTED)
  })

  it('接受不绑定实现的纯契约（先定义接口、后接实现）', async () => {
    const { service } = build()
    const saved = await service.createContract(contract())
    const impl = await service.bindImplementation(saved.id, {
      kind: AtomicImplementationKind.TYPESCRIPT,
    })
    expect(impl.moduleSha256).toBeNull()
  })

  it.each([
    [
      'Wasm 实现缺少模块哈希',
      { kind: AtomicImplementationKind.WASM, abiVersion: 1, tier: 'A' },
    ],
    [
      '模块哈希格式非法',
      {
        kind: AtomicImplementationKind.WASM,
        moduleSha256: 'not-a-hash',
        abiVersion: 1,
        tier: 'A',
      },
    ],
    [
      'ABI 版本不是 1',
      {
        kind: AtomicImplementationKind.WASM,
        moduleSha256: HASH,
        abiVersion: 2,
        tier: 'A',
      },
    ],
    [
      '缺少准入层级',
      {
        kind: AtomicImplementationKind.WASM,
        moduleSha256: HASH,
        abiVersion: 1,
      },
    ],
    [
      'Tier B 缺少审查背书',
      {
        kind: AtomicImplementationKind.WASM,
        moduleSha256: HASH,
        abiVersion: 1,
        tier: 'B',
      },
    ],
  ])('拒绝：%s', async (_label, input) => {
    const { service, implementations } = build()
    const saved = await service.createContract(contract())
    await expect(
      service.bindImplementation(saved.id, input as never),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(implementations.rows).toHaveLength(0)
  })

  it('契约不存在 → 404', async () => {
    const { service } = build()
    await expect(
      service.bindImplementation('missing', {
        kind: AtomicImplementationKind.TYPESCRIPT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('AtomicRegistryService 状态流转', () => {
  it('允许 submitted → built（复用 wasm-modules 的状态机）', () => {
    const { service } = build()
    expect(() =>
      service.assertTransitionAllowed(
        AdmissionStatus.SUBMITTED,
        AdmissionStatus.BUILT,
      ),
    ).not.toThrow()
  })

  it.each([
    ['跳过 built 直接 active', AdmissionStatus.SUBMITTED, AdmissionStatus.ACTIVE],
    ['rejected 是终态', AdmissionStatus.REJECTED, AdmissionStatus.BUILT],
    ['revoked 是终态', AdmissionStatus.REVOKED, AdmissionStatus.BUILT],
    ['active 不能再回 built', AdmissionStatus.ACTIVE, AdmissionStatus.BUILT],
  ])('拒绝：%s', (_label, from, to) => {
    const { service } = build()
    expect(() => service.assertTransitionAllowed(from, to)).toThrow(
      BadRequestException,
    )
  })

  it('promoteImplementation 实际推进状态', async () => {
    const { service, implementations, contracts } = build()
    const saved = await service.createContract(contract())
    const impl = await service.bindImplementation(saved.id, {
      kind: AtomicImplementationKind.TYPESCRIPT,
    })
    expect(contracts.rows).toHaveLength(1)
    void implementations

    // 闸 4：晋 built 需要闸 0 的源码预检报告 —— 证据是**平台记录**的，不接受随请求传入
    await service.recordReleaseEvidence(impl.id as string, {
      sourceGate: { language: 'rust', checks: ['no-build-rs'] },
    })
    const promoted = await service.promoteImplementation(
      impl.id as string,
      AdmissionStatus.BUILT,
    )
    expect(promoted.status).toBe(AdmissionStatus.BUILT)
  })

  it('promoteImplementation 缺证据 → 拒绝，并逐条列出缺什么', async () => {
    const { service } = build()
    const saved = await service.createContract(contract())
    const impl = await service.bindImplementation(saved.id, {
      kind: AtomicImplementationKind.TYPESCRIPT,
    })

    try {
      await service.promoteImplementation(impl.id as string, AdmissionStatus.BUILT)
      throw new Error('本应被闸 4 拒绝')
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      expect((error as Error).message).toContain('EVIDENCE_MISSING')
      expect((error as Error).message).toContain('sourceGate')
    }
  })

  it('首次绑定不得直接落在可运行状态（闸 4 不允许绕过影子期）', async () => {
    const { service } = build()
    const saved = await service.createContract(contract())

    await expect(
      service.bindImplementation(saved.id, {
        kind: AtomicImplementationKind.TYPESCRIPT,
        status: AdmissionStatus.ACTIVE,
      }),
    ).rejects.toThrow(/绑定被闸 4 拒绝\[TRANSITION_NOT_ALLOWED\]/)
  })

  describe('闸 4：走完整条晋升链（经服务层，不是只测纯函数）', () => {
    async function bindSubmitted() {
      const { service } = build()
      const saved = await service.createContract(contract())
      const impl = await service.bindImplementation(saved.id, {
        kind: AtomicImplementationKind.TYPESCRIPT,
      })
      return { service, id: impl.id as string }
    }

    it('逐级带证据 → 一路走到 active', async () => {
      const { service, id } = await bindSubmitted()

      await service.recordReleaseEvidence(id, {
        sourceGate: { language: 'rust', checks: ['no-build-rs'] },
      })
      expect((await service.promoteImplementation(id, AdmissionStatus.BUILT)).status).toBe(
        AdmissionStatus.BUILT,
      )

      await service.recordReleaseEvidence(id, {
        staticGate: { byteLength: 265, checks: ['import=env.memory(min=2,max=1024)'] },
        reproducibleBuildRef: 'repro:rust:1.95.0:abc',
      })
      expect((await service.promoteImplementation(id, AdmissionStatus.TESTED)).status).toBe(
        AdmissionStatus.TESTED,
      )

      await service.recordReleaseEvidence(id, {
        shadow: {
          parallelWith: 'available-inventory@1.0.0',
          startedAt: '2026-09-25T00:00:00Z',
          observedInvocations: 5000,
          differingResults: 0,
        },
      })
      expect((await service.promoteImplementation(id, AdmissionStatus.SHADOW)).status).toBe(
        AdmissionStatus.SHADOW,
      )

      await service.recordReleaseEvidence(id, {
        canary: {
          startedAt: '2026-09-25T02:00:00Z',
          observedInvocations: 20000,
          differingResults: 0,
        },
      })
      expect((await service.promoteImplementation(id, AdmissionStatus.CANARY)).status).toBe(
        AdmissionStatus.CANARY,
      )
      expect((await service.promoteImplementation(id, AdmissionStatus.ACTIVE)).status).toBe(
        AdmissionStatus.ACTIVE,
      )
    })

    it('影子记录是空的 → 卡在 tested，错误里说清缺什么', async () => {
      const { service, id } = await bindSubmitted()
      await service.recordReleaseEvidence(id, { sourceGate: {} })
      await service.promoteImplementation(id, AdmissionStatus.BUILT)
      await service.recordReleaseEvidence(id, {
        staticGate: {},
        reproducibleBuildRef: 'repro:rust:1.95.0:abc',
      })
      await service.promoteImplementation(id, AdmissionStatus.TESTED)

      await expect(service.promoteImplementation(id, AdmissionStatus.SHADOW)).rejects.toThrow(
        /shadow 记录/,
      )
    })

    it('吊销不受闸 4 限制：没有任何证据也能吊销', async () => {
      const { service, id } = await bindSubmitted()
      expect((await service.promoteImplementation(id, AdmissionStatus.REVOKED)).status).toBe(
        AdmissionStatus.REVOKED,
      )
    })

    it('补录只能做一次（第二次说明已经补录过）', async () => {
      const { service, id } = await bindSubmitted()
      await service.grandfatherImplementation(id, { reason: '存量', decidedBy: 'ops' })
      await expect(
        service.grandfatherImplementation(id, { reason: '再补一次', decidedBy: 'ops' }),
      ).rejects.toThrow(/已补录过/)
      expect(await service.listGrandfathered()).toHaveLength(1)
    })
  })
})

describe('AtomicRegistryService.importManifest', () => {
  it('导入真实清单：重算哈希通过、闸 1 复检通过、落台账', async () => {
    if (!existsSync(REAL_MANIFEST)) return // 未构建 wasm 产物时跳过
    const { service, manifests } = build()

    const result = await service.importManifest(REAL_MANIFEST, 'test')

    expect(result.rejected).toEqual([])
    expect(result.imported).toHaveLength(1)
    // 闸报告随导入结果一起返回，绑定实现时可直接写入 staticGate
    expect(result.imported[0].sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.imported[0].staticGate).toBeTruthy()
    expect(manifests.rows).toHaveLength(1)
    // 台账存的是**实测**哈希与字节数，不是清单自述值
    const row = manifests.rows[0] as Record<string, unknown>
    const shipped = new Uint8Array(
      readFileSync(resolve(REAL_MANIFEST, '..', row.file as string)),
    )
    expect(row.sha256).toBe(sha256(shipped))
    expect(row.sizeBytes).toBe(shipped.length)
  })

  it('同哈希重复导入 → 幂等跳过，不产生重复台账', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { service, manifests } = build()

    await service.importManifest(REAL_MANIFEST, 'test')
    const second = await service.importManifest(REAL_MANIFEST, 'test')

    expect(second.imported).toEqual([])
    expect(second.skipped).toHaveLength(1)
    expect(manifests.rows).toHaveLength(1)
  })

  it('字节被篡改 → 该条目被拒且不落台账', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const tempDir = mkdtempSync(join(tmpdir(), 'speckit-manifest-'))
    try {
      const original = JSON.parse(readFileSync(REAL_MANIFEST, 'utf8'))
      const file = original.modules[0].file as string
      copyFileSync(resolve(REAL_MANIFEST, '..', file), join(tempDir, file))
      // 改一个字节：哈希随之改变，但清单仍声明旧哈希
      const bytes = readFileSync(join(tempDir, file))
      bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0xff
      writeFileSync(join(tempDir, file), bytes)
      const tamperedManifest = join(tempDir, 'manifest.json')
      writeFileSync(tamperedManifest, JSON.stringify(original, null, 2))

      const { service, manifests } = build()
      const result = await service.importManifest(tamperedManifest, 'test')

      expect(result.imported).toEqual([])
      expect(result.rejected).toHaveLength(1)
      expect(result.rejected[0].reason).toContain('哈希与清单声明不符')
      expect(manifests.rows).toHaveLength(0)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('哈希对得上但静态闸不过 → 仍被拒（不采信清单里的闸报告）', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'speckit-badgate-'))
    try {
      // 造一个含 WASI 导入的模块：结构合法、能被引擎加载，但必被闸 1 拒
      const bad = buildFixtureWasm({ importWasi: 'fd_write' })
      const file = 'rogue-000000000000.wasm'
      writeFileSync(join(tempDir, file), bad)
      writeFileSync(
        join(tempDir, 'manifest.json'),
        JSON.stringify({
          generatedBy: 'test',
          modules: [
            {
              atomicType: 'rogue',
              file,
              tier: 'A',
              abiVersion: 1,
              sha256: sha256(bad),
              sizeBytes: bad.length,
              compiler: { name: 'rust', version: '1.95.0' },
              language: 'rust',
              reproducibleBuildRef: 'ref',
              staticGate: {
                byteLength: bad.length,
                memoryPages: { min: 2, max: 1024 },
                exports: ['run', 'abi_version'],
                abiVersionExportKind: 'function',
                checks: ['no-start-section'],
              },
            },
          ],
        }),
      )

      const { service, manifests } = build()
      const result = await service.importManifest(
        join(tempDir, 'manifest.json'),
        'test',
      )

      expect(result.imported).toEqual([])
      expect(result.rejected[0].reason).toContain('静态闸复检不通过')
      expect(manifests.rows).toHaveLength(0)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('清单不符合 Schema → 直接拒，不进入逐条处理', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'speckit-badschema-'))
    try {
      const badManifest = join(tempDir, 'manifest.json')
      writeFileSync(
        badManifest,
        JSON.stringify({ generatedBy: 'test', modules: [{ file: 'x.wasm' }] }),
      )
      const { service, manifests } = build()
      await expect(
        service.importManifest(badManifest, 'test'),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(manifests.rows).toHaveLength(0)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('清单文件不存在 → 404', async () => {
    const { service } = build()
    await expect(
      service.importManifest('/nonexistent/manifest.json', 'test'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
