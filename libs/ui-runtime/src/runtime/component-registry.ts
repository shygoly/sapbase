/**
 * UI componentKey 白名单解析。
 *
 * 只允许本地注册键；未知键按页面类型回退默认组件。
 * 禁止远端脚本、URL、动态 import 或任意组件路径。
 */

export type DefaultUiComponent = 'schema-list' | 'schema-form' | 'detail' | 'dashboard'
export type ResolvedUiComponentKey =
  | DefaultUiComponent
  | 'workbench'
  | 'timeline'
  | 'default-list'
  | 'default-form'
  | 'default-detail'

const ALIASES: Record<string, ResolvedUiComponentKey> = {
  'default-list': 'schema-list',
  'default-form': 'schema-form',
  'default-detail': 'detail',
  'schema-list': 'schema-list',
  'schema-form': 'schema-form',
  detail: 'detail',
  dashboard: 'dashboard',
  workbench: 'workbench',
  timeline: 'timeline',
}

export function resolveUiComponent(
  componentKey: string | null | undefined,
  pageType: 'list' | 'form' | 'detail' | 'dashboard' = 'list',
): ResolvedUiComponentKey {
  const fallback: ResolvedUiComponentKey =
    pageType === 'form'
      ? 'schema-form'
      : pageType === 'detail'
        ? 'detail'
        : pageType === 'dashboard'
          ? 'dashboard'
          : 'schema-list'
  if (!componentKey) return fallback
  return ALIASES[componentKey] ?? fallback
}
