/**
 * v1 确定性规则表。触发词不能进工具契约（additionalProperties: false 已冻结），
 * 所以规则放在编排器里；加载时校验每条规则的目标工具 ∈ 契约。
 */
import type { ToolCatalog } from '../agent-tools/contracts-loader'

export interface IntentRule {
  id: string
  tool: string
  label: string
  tryMatch: (message: string) => Record<string, unknown> | null
}

export function assertRulesTargetCatalog(
  rules: ReadonlyArray<{ id: string; tool: string }>,
  catalog: ToolCatalog,
): void {
  const names = new Set(catalog.tools.map((tool) => tool.name))
  for (const rule of rules) {
    if (!names.has(rule.tool)) {
      throw new Error(
        `意图规则 ${rule.id} 指向契约里不存在的工具：${rule.tool}（规则是候选，契约是裁决）`,
      )
    }
  }
}

const QUOTED = /[「『“”‘’"'']([^」』“”‘’"']+)[」』“”‘’"'']/
const CALLED =
  /叫\s*(?:[「『“”‘’"'']([^」』“”‘’"']+)[」』“”‘’"'']|([A-Za-z0-9][A-Za-z0-9._-]*))\s*的(?:模块|包|蓝图包|蓝图|原子)/

function quoted(message: string): string | undefined {
  const value = message.match(QUOTED)?.[1]?.trim()
  return value || undefined
}

function equalsValue(message: string, key: string): string | undefined {
  const match = message.match(new RegExp(`\\b${key}\\s*=\\s*([A-Za-z0-9][A-Za-z0-9._-]*)`, 'i'))
  return match?.[1]
}

function calledName(message: string): string | undefined {
  const match = message.match(CALLED)
  const value = (match?.[1] ?? match?.[2])?.trim()
  return value || undefined
}

function afterKeyword(message: string, keyword: string): string | undefined {
  const match = message.match(new RegExp(`${keyword}\\s+([A-Za-z0-9][A-Za-z0-9._-]*)`))
  return match?.[1]
}

function extractId(message: string): string | undefined {
  return (
    quoted(message) ??
    equalsValue(message, 'id') ??
    calledName(message) ??
    afterKeyword(message, '模块') ??
    afterKeyword(message, '(?:蓝图)?包')
  )
}

function extractAtomicType(message: string): string | undefined {
  return (
    quoted(message) ??
    equalsValue(message, 'atomicType') ??
    calledName(message) ??
    afterKeyword(message, '原子')
  )
}

function requireId(message: string): Record<string, unknown> | null {
  const id = extractId(message)
  return id ? { id } : null
}

function requireAtomicType(message: string): Record<string, unknown> | null {
  const atomicType = extractAtomicType(message)
  return atomicType ? { atomicType } : null
}

function triggered(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message))
}

export const INTENT_RULES: readonly IntentRule[] = [
  {
    id: 'blueprint.list',
    tool: 'erp_blueprint_list',
    label: '列出已登记的蓝图包',
    tryMatch: (message) =>
      triggered(message, [
        /有哪些蓝图/,
        /列出.{0,12}蓝图/,
        /已登记的蓝图/,
        /蓝图包列表/,
      ])
        ? {}
        : null,
  },
  {
    id: 'blueprint.manifest',
    tool: 'erp_blueprint_manifest',
    label: '查看蓝图包清单',
    tryMatch: (message) =>
      triggered(message, [/清单/, /manifest/i]) ? requireId(message) : null,
  },
  {
    id: 'blueprint.compile',
    tool: 'erp_blueprint_compile',
    label: '编译蓝图包',
    tryMatch: (message) => (triggered(message, [/编译/]) ? requireId(message) : null),
  },
  {
    id: 'atomic.invoke',
    tool: 'erp_atomic_invoke',
    label: '运行原子',
    tryMatch: (message) =>
      triggered(message, [/跑.{0,8}原子/, /调用原子/, /执行原子/])
        ? requireAtomicType(message)
        : null,
  },
  {
    id: 'module.list',
    tool: 'erp_module_list',
    label: '列出当前组织的模块',
    tryMatch: (message) =>
      triggered(message, [
        /有哪些模块/,
        /列出.{0,12}模块/,
        /模块列表/,
        /模块注册表/,
      ])
        ? {}
        : null,
  },
  {
    id: 'module.export',
    tool: 'erp_module_export',
    label: '导出模块为最小蓝图包',
    tryMatch: (message) => (triggered(message, [/导出/]) ? requireId(message) : null),
  },
]
