import {
  assertCanMoveNode,
  buildScopeNodePath,
  replaceScopePathPrefix,
  ScopeTreeError,
} from './scope-tree'

describe('scope tree helpers', () => {
  it('build path', () => {
    expect(buildScopeNodePath(null, 'root')).toBe('/root')
    expect(buildScopeNodePath('/root/province', 'city')).toBe('/root/province/city')
  })

  it('拒绝移动到自身/后代', () => {
    expect(() => assertCanMoveNode('/a/b', '/a/b')).toThrow(ScopeTreeError)
    expect(() => assertCanMoveNode('/a/b', '/a/b/c')).toThrow(/后代/)
    expect(() => assertCanMoveNode('/a/b', '/a/c')).not.toThrow()
  })

  it('替换路径前缀', () => {
    expect(replaceScopePathPrefix('/a/b/c', '/a/b', '/x')).toBe('/x/c')
    expect(replaceScopePathPrefix('/a/b', '/a/b', '/x')).toBe('/x')
    expect(() => replaceScopePathPrefix('/a/c', '/a/b', '/x')).toThrow(/不在前缀/)
  })
})
