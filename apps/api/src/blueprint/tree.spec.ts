import { detectConflicts } from '@sap/platform-release/blueprint/compiler'

function chapter(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Chapter',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'parentId', type: 'reference', reference: 'Chapter' },
      { name: 'sortOrder', type: 'i32' },
    ],
    states: [{ name: 'active', initial: true }, { name: 'closed', final: true }],
    transitions: [{ from: 'active', to: 'closed' }],
    ...overrides,
  }
}

function conflicts(entity: Record<string, unknown>) {
  return detectConflicts(
    { entities: [entity] } as never,
    { flows: [] } as never,
    [] as never,
  )
}

describe('blueprint tree metadata', () => {
  it('合法 tree 通过编译校验', () => {
    expect(conflicts(chapter({ tree: { parentField: 'parentId', orderField: 'sortOrder' } }))).toEqual([])
  })

  it('parentField 不存在 / 非自引用 → 冲突', () => {
    expect(
      conflicts(chapter({ tree: { parentField: 'missingParent', orderField: 'sortOrder' } })),
    ).toEqual(expect.arrayContaining([expect.stringContaining('parentField')]))
    expect(
      conflicts(
        chapter({
          fields: [
            { name: 'parentId', type: 'reference', reference: 'Other' },
            { name: 'sortOrder', type: 'i32' },
          ],
          tree: { parentField: 'parentId', orderField: 'sortOrder' },
        }),
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining('自引用 reference')]))
  })

  it('orderField 不存在/非数值 → 冲突', () => {
    expect(
      conflicts(chapter({ tree: { parentField: 'parentId', orderField: 'missingOrder' } })),
    ).toEqual(expect.arrayContaining([expect.stringContaining('orderField')]))
    expect(
      conflicts(
        chapter({
          fields: [
            { name: 'parentId', type: 'text' },
            { name: 'sortOrder', type: 'text' },
          ],
          tree: { parentField: 'parentId', orderField: 'sortOrder' },
        }),
      ),
    ).toEqual(expect.arrayContaining([expect.stringContaining('数值字段')]))
  })

  it('未声明 tree 不产生树冲突', () => {
    expect(conflicts(chapter())).toEqual([])
  })
})
