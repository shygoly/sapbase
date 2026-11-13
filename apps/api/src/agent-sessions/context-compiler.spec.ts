import { compileContext } from '@sap/agent-kernel'

const node = (
  id: string,
  overrides: Record<string, unknown> = {},
): any => ({
  id,
  kind: 'knowledge',
  tokens: 5,
  ...overrides,
})

describe('compileContext', () => {
  it('依赖闭包：requested 节点自动带入 dependsOn', () => {
    const result = compileContext({
      nodes: [
        node('base', { tokens: 2 }),
        node('child', { dependsOn: ['base'], tokens: 3 }),
        node('other'),
      ],
      requested: ['child'],
      permissions: [],
      budget: { maxTokens: 100 },
    })
    expect(result.nodes.map((entry) => entry.id).sort()).toEqual([
      'base',
      'child',
    ])
    expect(result.closureSize).toBe(2)
    expect(result.tokens).toBe(5)
  })

  it('缺依赖/环：节点被丢弃并记录原因', () => {
    const missing = compileContext({
      nodes: [node('a', { dependsOn: ['missing'] })],
      requested: ['a'],
      permissions: [],
      budget: { maxTokens: 100 },
    })
    expect(missing.nodes).toEqual([])
    expect(missing.dropped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'missing', reason: 'missing' }),
        expect.objectContaining({ id: 'a', reason: 'missing' }),
      ]),
    )

    const cycle = compileContext({
      nodes: [
        node('a', { dependsOn: ['b'] }),
        node('b', { dependsOn: ['a'] }),
      ],
      requested: ['a'],
      permissions: [],
      budget: { maxTokens: 100 },
    })
    expect(cycle.nodes).toEqual([])
    expect(cycle.dropped.some((entry) => entry.reason === 'cycle')).toBe(true)
  })

  it('权限过滤：缺任一权限的节点及其依赖者不进入上下文', () => {
    const result = compileContext({
      nodes: [
        node('secret', { permissions: ['finance:read', 'finance:admin'] }),
        node('derived', { dependsOn: ['secret'] }),
        node('public'),
      ],
      requested: ['derived', 'public'],
      permissions: ['finance:read'],
      budget: { maxTokens: 100 },
    })
    expect(result.nodes.map((entry) => entry.id)).toEqual(['public'])
    expect(result.dropped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'secret', reason: 'permission' }),
        expect.objectContaining({ id: 'derived', reason: 'missing' }),
      ]),
    )
  })

  it('预算：按 score 降序、id 升序确定性裁剪，记录 budget 原因', () => {
    const result = compileContext({
      nodes: [
        node('low', { tokens: 10, score: 1 }),
        node('high', { tokens: 10, score: 10 }),
        node('same-b', { tokens: 10, score: 5 }),
        node('same-a', { tokens: 10, score: 5 }),
      ],
      requested: ['low', 'high', 'same-a', 'same-b'],
      permissions: [],
      budget: { maxTokens: 30, maxNodes: 3 },
    })
    expect(result.nodes.map((entry) => entry.id)).toEqual([
      'high',
      'same-a',
      'same-b',
    ])
    expect(result.tokens).toBe(30)
    expect(result.dropped).toEqual(
      expect.arrayContaining([{ id: 'low', reason: 'budget' }]),
    )
  })

  it('空预算/空 requested 返回空上下文', () => {
    const result = compileContext({
      nodes: [node('a')],
      requested: [],
      permissions: [],
      budget: { maxTokens: 100 },
    })
    expect(result.nodes).toEqual([])
    expect(result.closureSize).toBe(0)

    const zero = compileContext({
      nodes: [node('a')],
      requested: ['a'],
      permissions: [],
      budget: { maxTokens: 0 },
    })
    expect(zero.nodes).toEqual([])
    expect(zero.dropped).toEqual([{ id: 'a', reason: 'budget' }])
  })
})
