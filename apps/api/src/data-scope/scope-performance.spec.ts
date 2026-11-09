import { ScopeEvaluator } from './scope-evaluator'
import type { ScopeNodeView } from './data-scope.types'

describe('ScopeEvaluator performance baseline', () => {
  it('10k 节点子树展开 + 策略解析在基线内完成', () => {
    const evaluator = new ScopeEvaluator()
    const root: ScopeNodeView = { id: 'root', dimensionKey: 'region', path: '/root' }
    const nodes: ScopeNodeView[] = [root]
    for (let i = 0; i < 10_000; i++) {
      nodes.push({ id: `n${i}`, dimensionKey: 'region', path: `/root/n${i}` })
    }

    const started = performance.now()
    for (let i = 0; i < 5; i++) {
      const expr = evaluator.evaluate({
        resourceKey: 'platform:crm_customers',
        action: 'read',
        actor: { userId: 'u1', roleKeys: ['region_manager'], groupKeys: [] },
        declared: true,
        bindings: [
          {
            resourceKey: 'platform:crm_customers',
            dimensionKey: 'region',
            kind: 'field',
            field: 'regionId',
          },
        ],
        memberships: [
          {
            subjectType: 'user',
            subjectId: 'u1',
            nodeId: 'root',
            positionKey: 'region_manager',
            node: root,
          },
        ],
        nodes,
        policies: [
          {
            subject: { kind: 'role', roleKey: 'region_manager' },
            resourceKey: 'platform:crm_customers',
            actions: ['read'],
            effect: 'allow',
            scope: {
              kind: 'node',
              dimension: 'region',
              anchor: 'membership',
              positions: ['region_manager'],
              depth: 'subtree',
            },
            status: 'active',
          },
        ],
      })
      expect(expr.op).toBe('in')
    }
    const elapsed = performance.now() - started
    // 基线宽松：10k 节点 × 5 次；真实性能可用压测复测。
    expect(elapsed).toBeLessThan(1000)
  })
})
