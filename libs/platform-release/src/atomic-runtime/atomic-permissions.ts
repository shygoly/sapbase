import { ForbiddenException } from '@nestjs/common'

/**
 * 契约权限校验。
 *
 * 与 `auth/permissions.guard.ts` 的区别（**不是重复实现，语义不同**）：
 *   · 那个守卫是**静态**的：权限点写在 `@Permissions(...)` 装饰器里，且是 **any-of**
 *     —— "这些权限里有任意一个就能访问该端点"。
 *   · 这里是**运行时**的：权限点来自数据库里的契约，且是 **all-of**
 *     —— 契约声明 `['inventory.read', 'cost.read']` 就必须两个都有，
 *       少一个是**调用方不具备执行该原子的资格**，不是"换个端口试试"。
 *
 * fail-closed：任一声明的权限缺失即拒（元语不变量 4）。
 */
export function missingPermissions(
  required: string[],
  granted: readonly string[],
): string[] {
  if (required.length === 0) return []
  const has = new Set(granted)
  return required.filter((permission) => !has.has(permission))
}

export function assertContractPermissions(
  atomicType: string,
  required: string[],
  granted: readonly string[],
): void {
  const missing = missingPermissions(required, granted)
  if (missing.length > 0) {
    throw new ForbiddenException(
      `调用 ${atomicType} 需要权限：${missing.join(', ')}（契约声明的权限点必须全部满足）`,
    )
  }
}
