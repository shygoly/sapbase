import { applyScopeToQueryBuilder } from './scope-query'

function qb() {
  const builder = { andWhere: jest.fn() }
  builder.andWhere.mockReturnValue(builder)
  return builder
}

describe('applyScopeToQueryBuilder', () => {
  it('all 不加条件', () => {
    const builder = qb()
    applyScopeToQueryBuilder(builder as never, { op: 'all' }, {
      alias: 'r',
      organizationId: 'org-1',
      actorId: 'u1',
    })
    expect(builder.andWhere).not.toHaveBeenCalled()
  })

  it('none 直接 1=0', () => {
    const builder = qb()
    applyScopeToQueryBuilder(builder as never, { op: 'none' }, {
      alias: 'r',
      organizationId: 'org-1',
      actorId: 'u1',
    })
    expect(builder.andWhere).toHaveBeenCalledWith('1=0')
  })

  it('普通谓词带参数', () => {
    const builder = qb()
    applyScopeToQueryBuilder(
      builder as never,
      {
        op: 'eq',
        field: { kind: 'column', column: 'ownerId' },
        value: { kind: 'actor' },
      },
      { alias: 'r', organizationId: 'org-1', actorId: 'u1' },
    )
    expect(builder.andWhere).toHaveBeenCalledWith('"r"."ownerId" = $1', ['u1'])
  })
})
