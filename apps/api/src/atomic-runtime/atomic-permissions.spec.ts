// 契约权限校验：all-of 语义 + fail-closed。
import { ForbiddenException } from '@nestjs/common'
import {
  assertContractPermissions,
  missingPermissions,
} from './atomic-permissions'

describe('missingPermissions', () => {
  it('契约未声明权限 → 不需要任何权限', () => {
    expect(missingPermissions([], [])).toEqual([])
    expect(missingPermissions([], ['x'])).toEqual([])
  })

  it('all-of 语义：少一个就算缺（不是 any-of）', () => {
    expect(
      missingPermissions(['inventory.read', 'cost.read'], ['inventory.read']),
    ).toEqual(['cost.read'])
    expect(
      missingPermissions(
        ['inventory.read', 'cost.read'],
        ['inventory.read', 'cost.read', 'other'],
      ),
    ).toEqual([])
  })
})

describe('assertContractPermissions', () => {
  it('权限齐备 → 放行', () => {
    expect(() =>
      assertContractPermissions('available-inventory', ['inventory.read'], [
        'inventory.read',
      ]),
    ).not.toThrow()
  })

  it('缺权限 → 403 且列出缺了哪些（不是笼统的"权限不足"）', () => {
    let thrown: unknown
    try {
      assertContractPermissions(
        'available-inventory',
        ['inventory.read', 'cost.read'],
        ['cost.read'],
      )
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(ForbiddenException)
    expect((thrown as Error).message).toContain('inventory.read')
    expect((thrown as Error).message).not.toContain('cost.read（')
  })
})
