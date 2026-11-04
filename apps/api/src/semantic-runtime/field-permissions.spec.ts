import {
  canReadAllOwned,
  forbiddenWriteFields,
  filterOwnedRows,
  isOwnedVisible,
  omitRestrictedFields,
  declaredMoneyCurrency,
  actorId,
  actorPermissions,
} from './field-permissions'

const PART = {
  name: 'Part',
  fields: [
    { name: 'partNo' },
    { name: 'unitCost', permissions: { read: 'inventory.cost.read', write: 'inventory.cost.write' } },
    { name: 'name' },
  ],
}

const ORDER = {
  name: 'SalesOrder',
  fields: [
    { name: 'customer' },
    { name: 'owner' },
    { name: 'number' },
  ],
  ownership: { field: 'owner', readAllPermission: 'sales.order.readall' },
}

describe('字段级读省略', () => {
  it('缺少 read 权限 → 省略字段并列入 omittedFields', () => {
    const result = omitRestrictedFields(
      PART,
      { partNo: 'P-1', unitCost: '12.5000', name: '垫片' },
      [],
    )
    expect(result.data).toEqual({ partNo: 'P-1', name: '垫片' })
    expect(result.omittedFields).toEqual(['unitCost'])
  })

  it('持有 read 权限 → 不省略', () => {
    const result = omitRestrictedFields(
      PART,
      { partNo: 'P-1', unitCost: '12.5000' },
      ['inventory.cost.read'],
    )
    expect(result.data.unitCost).toBe('12.5000')
    expect(result.omittedFields).toEqual([])
  })

  it('未声明 permissions.read 的字段不受限（默认开放读）', () => {
    const result = omitRestrictedFields(PART, { partNo: 'P-1', name: '垫片' }, [])
    expect(result.data).toEqual({ partNo: 'P-1', name: '垫片' })
    expect(result.omittedFields).toEqual([])
  })

  it('没有 user / 没有 permissions 视为空权限', () => {
    expect(actorPermissions(undefined)).toEqual([])
    expect(actorPermissions({})).toEqual([])
    const result = omitRestrictedFields(PART, { unitCost: '1' }, actorPermissions(undefined))
    expect(result.omittedFields).toEqual(['unitCost'])
  })

  it('写入盖章的 __currency 不出现在返回 data', () => {
    const result = omitRestrictedFields(
      PART,
      { partNo: 'P-1', __currency: 'CNY' },
      [],
    )
    expect(result.data).toEqual({ partNo: 'P-1' })
    expect(result.data.__currency).toBeUndefined()
  })
})

describe('字段级写拒绝', () => {
  it('缺少 write 权限的字段 → 列入 forbidden', () => {
    expect(forbiddenWriteFields(PART, { partNo: 'P-1', unitCost: 12.5 }, [])).toEqual(['unitCost'])
  })

  it('持有 write 权限 → 不拒', () => {
    expect(
      forbiddenWriteFields(PART, { partNo: 'P-1', unitCost: 12.5 }, ['inventory.cost.write']),
    ).toEqual([])
  })

  it('未声明 write 的字段不受限；children 不是字段', () => {
    expect(
      forbiddenWriteFields(PART, { partNo: 'P-1', name: '垫片', children: {} }, []),
    ).toEqual([])
  })
})

describe('单据级 ownership', () => {
  it('只返回归属等于调用方 id 的行', () => {
    const rows = [
      { id: '1', data: { owner: 'alice', number: 'SO-1' } },
      { id: '2', data: { owner: 'bob', number: 'SO-2' } },
    ]
    const filtered = filterOwnedRows(ORDER, rows, { id: 'alice', permissions: [] })
    expect(filtered.map((row) => row.id)).toEqual(['1'])
  })

  it('持有 readAllPermission → 不筛', () => {
    const rows = [
      { id: '1', data: { owner: 'alice' } },
      { id: '2', data: { owner: 'bob' } },
    ]
    const filtered = filterOwnedRows(ORDER, rows, {
      id: 'alice',
      permissions: ['sales.order.readall'],
    })
    expect(filtered).toHaveLength(2)
    expect(canReadAllOwned(ORDER, ['sales.order.readall'])).toBe(true)
  })

  it('负例：归属字段为空 / 缺失的行对所有人可见', () => {
    const rows = [
      { id: 'empty', data: { owner: '' } },
      { id: 'missing', data: { number: 'SO-X' } },
      { id: 'other', data: { owner: 'bob' } },
    ]
    const filtered = filterOwnedRows(ORDER, rows, { userId: 'alice' })
    expect(filtered.map((row) => row.id)).toEqual(['empty', 'missing'])
    expect(isOwnedVisible(ORDER, { owner: null }, { id: 'alice' })).toBe(true)
  })

  it('未声明 ownership → 不筛', () => {
    const rows = [{ id: '1', data: { owner: 'bob' } }]
    expect(filterOwnedRows(PART, rows, { id: 'alice' })).toEqual(rows)
  })

  it('actorId 优先 id，其次 userId', () => {
    expect(actorId({ id: 'a', userId: 'b' })).toBe('a')
    expect(actorId({ userId: 'b' })).toBe('b')
    expect(actorId({})).toBeUndefined()
  })
})

describe('货币盖章', () => {
  it('取第一个 money 字段的 currency', () => {
    expect(
      declaredMoneyCurrency([
        { money: true, currency: 'CNY' },
        { money: true, currency: 'USD' },
      ]),
    ).toBe('CNY')
    expect(declaredMoneyCurrency([{ type: 'text' } as never])).toBeUndefined()
  })
})
