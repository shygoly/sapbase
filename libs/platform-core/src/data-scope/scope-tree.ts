export class ScopeTreeError extends Error {
  constructor(
    message: string,
    public readonly reason: 'cycle' | 'cross-tree' | 'invalid-path',
  ) {
    super(message)
    this.name = 'ScopeTreeError'
  }
}

export function buildScopeNodePath(parentPath: string | null | undefined, id: string): string {
  if (!id) throw new ScopeTreeError('节点 id 不能为空', 'invalid-path')
  return parentPath ? `${parentPath}/${id}` : `/${id}`
}

/**
 * 移动前防环：新父节点不能是自身或自身后代。
 * 路径约定：/a/b/c，节点自身路径包含在 prefix 中。
 */
export function assertCanMoveNode(nodePath: string, newParentPath: string | null | undefined): void {
  if (!newParentPath) return
  if (newParentPath === nodePath) {
    throw new ScopeTreeError('不能把节点移动到自身下面', 'cycle')
  }
  if (newParentPath.startsWith(`${nodePath}/`)) {
    throw new ScopeTreeError('不能把节点移动到自身后代下面', 'cycle')
  }
}

export function replaceScopePathPrefix(
  path: string,
  oldPrefix: string,
  newPrefix: string,
): string {
  if (path === oldPrefix) return newPrefix
  if (!path.startsWith(`${oldPrefix}/`)) {
    throw new ScopeTreeError(`路径 ${path} 不在前缀 ${oldPrefix} 之下`, 'invalid-path')
  }
  return `${newPrefix}${path.slice(oldPrefix.length)}`
}
