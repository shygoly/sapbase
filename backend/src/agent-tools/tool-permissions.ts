/**
 * 平台**支持**的工具权限点。
 *
 * 这是协议面，不是授权面：
 *   · 本清单 = 平台支持什么（契约里的 `permission` 必须落在这里，否则契约非法）
 *   · `permissions` 表 = 组织授予了什么（由既有 permissions CRUD 写入）
 *
 * 两件事不要混。授权（往 `permissions` 表里插 `tool:*` 行）不在 C2 范围：
 * 本里程碑不写 seed、不写数据迁移。
 */
export const TOOL_PERMISSION_CATALOG = [
  'tool:blueprint:read',
  'tool:blueprint:compile',
  'tool:atomic:invoke',
  'tool:module:read',
  'tool:module:export',
] as const

export type ToolPermission = (typeof TOOL_PERMISSION_CATALOG)[number]

export function isSupportedToolPermission(
  permission: string,
): permission is ToolPermission {
  return (TOOL_PERMISSION_CATALOG as readonly string[]).includes(permission)
}
