// 模块发布前的原子依赖校验（元语不变量 4：依赖不满足就不许发布）。
import { BadRequestException } from '@nestjs/common'
import { ModuleRegistryService } from './module-registry.service'

type ResolveFn = (atomicType: string, range: string) => Promise<unknown>

function build(resolve: ResolveFn) {
  const calls: Array<[string, string]> = []
  const service = new ModuleRegistryService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      resolve: async (atomicType: string, range: string) => {
        calls.push([atomicType, range])
        return resolve(atomicType, range)
      },
    } as never,
  )
  return { service, calls }
}

describe('assertAtomicDependencies', () => {
  it('没有依赖 → 直接通过，不去解析', async () => {
    const { service, calls } = build(async () => ({}))
    await expect(service.assertAtomicDependencies([])).resolves.toBeUndefined()
    expect(calls).toEqual([])
  })

  it('依赖可解析 → 通过，且 type/range 切分正确', async () => {
    const { service, calls } = build(async () => ({}))
    await expect(
      service.assertAtomicDependencies(['available-inventory@^1.0.0']),
    ).resolves.toBeUndefined()
    expect(calls).toEqual([['available-inventory', '^1.0.0']])
  })

  it('依赖不可用 → 拒绝，并**一次列出全部**缺失项（不是遇到第一条就停）', async () => {
    const { service, calls } = build(async (atomicType: string) => {
      if (atomicType === 'available-inventory') return {}
      throw new Error(`没有 active 的契约：${atomicType}`)
    })

    let thrown: unknown
    try {
      await service.assertAtomicDependencies([
        'available-inventory@^1.0.0',
        'post-inventory-movement@^2.0.0',
        'calculate-mrp@^1.0.0',
      ])
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(BadRequestException)
    const message = (thrown as Error).message
    expect(message).toContain('post-inventory-movement@^2.0.0')
    expect(message).toContain('calculate-mrp@^1.0.0')
    // 三条都试过：第一条成功的没有造成提前返回
    expect(calls).toHaveLength(3)
  })

  it('格式非法（缺 @ 或范围为空）→ 以明确原因拒绝', async () => {
    const { service } = build(async () => ({}))
    await expect(
      service.assertAtomicDependencies(['available-inventory']),
    ).rejects.toThrow(/格式应为 atomicType@range/)
    await expect(
      service.assertAtomicDependencies(['available-inventory@']),
    ).rejects.toThrow(/格式应为 atomicType@range/)
  })
})
