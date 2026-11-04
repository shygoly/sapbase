// MCP 投影：把 contracts/tools.json 的契约投影成 MCP 工具清单。
//
// 原则：**只有一处真源**。工具名、描述、参数 schema、写标记、确认策略、超时、
// allowedAgents 全部来自契约；本文件不做任何"补充定义"，只做形状转换。
// 生成物由 scripts/meta/project-mcp-tools.mjs 写出，并由 check-agent-tools.mjs 做漂移对拍。

export const MCP_PROJECTION_VERSION = 1

export const MCP_MANIFEST_NOTE =
  'GENERATED — 由 scripts/meta/project-mcp-tools.mjs 从工具契约生成，不要手改。'

/** 契约字段 → 默认值，与 AGENT-TOOLS.md / registry 的默认保持一致。 */
export function withContractDefaults(tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
    permission: tool.permission,
    write: tool.write,
    confirmation: tool.confirmation,
    timeoutMs: tool.timeoutMs ?? 5000,
    untrustedResult: tool.untrustedResult ?? false,
    sensitiveArgs: [...(tool.sensitiveArgs ?? [])].sort(),
    allowedAgents: [...(tool.allowedAgents ?? [])].sort(),
    agentInvocable: tool.agentInvocable ?? true,
  }
}

/**
 * 单个工具 → MCP Tool。
 * - annotations 只是给宿主的**提示**（readOnly/destructive），不是授权依据。
 * - 授权信息放 _meta，网关仍是唯一裁决点。
 */
export function toMcpTool(tool) {
  const t = withContractDefaults(tool)
  return {
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: {
      readOnlyHint: t.write !== true,
      destructiveHint: t.write === true,
      idempotentHint: t.write !== true,
      openWorldHint: t.untrustedResult === true,
    },
    _meta: {
      'sapbase/permission': t.permission,
      'sapbase/confirmation': t.confirmation,
      'sapbase/timeoutMs': t.timeoutMs,
      'sapbase/untrustedResult': t.untrustedResult,
      'sapbase/sensitiveArgs': t.sensitiveArgs,
      'sapbase/allowedAgents': t.allowedAgents,
      'sapbase/agentInvocable': t.agentInvocable,
    },
  }
}

/** 全量清单：按工具名排序，保证生成物稳定可比。 */
export function projectManifest(tools) {
  return {
    version: MCP_PROJECTION_VERSION,
    source: 'contracts/tools.json',
    note: MCP_MANIFEST_NOTE,
    tools: tools.map(toMcpTool).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** 稳定序列化：对象键排序，用于"是否有漂移"的逐字节比较。 */
export function stableStringify(value) {
  const seen = new WeakSet()
  const normalize = (v) => {
    if (v === null || typeof v !== 'object') return v
    if (seen.has(v)) throw new Error('stableStringify: 循环引用')
    seen.add(v)
    if (Array.isArray(v)) {
      const out = v.map(normalize)
      seen.delete(v)
      return out
    }
    const out = {}
    for (const key of Object.keys(v).sort()) out[key] = normalize(v[key])
    seen.delete(v)
    return out
  }
  return `${JSON.stringify(normalize(value), null, 2)}\n`
}

/**
 * 比较两份清单，返回人类可读的差异列表；无差异返回空数组。
 * 逐工具比较，便于定位是哪个工具漂移。
 */
export function diffManifests(expected, actual) {
  const problems = []
  if (!actual || typeof actual !== 'object') return ['清单不是对象']
  if (actual.version !== expected.version) {
    problems.push(`version 不一致：manifest=${actual.version} expected=${expected.version}`)
  }
  if (actual.source !== expected.source) {
    problems.push(`source 不一致：manifest=${actual.source} expected=${expected.source}`)
  }
  const actualTools = Array.isArray(actual.tools) ? actual.tools : []
  const expectedTools = Array.isArray(expected.tools) ? expected.tools : []
  const actualMap = new Map(actualTools.map((t) => [t?.name, t]))
  const expectedMap = new Map(expectedTools.map((t) => [t?.name, t]))

  for (const name of expectedMap.keys()) {
    if (!actualMap.has(name)) problems.push(`清单缺少工具：${name}`)
  }
  for (const name of actualMap.keys()) {
    if (!expectedMap.has(name)) problems.push(`清单多出工具：${name}`)
  }
  for (const [name, exp] of expectedMap) {
    const act = actualMap.get(name)
    if (!act) continue
    if (stableStringify(exp) !== stableStringify(act)) {
      problems.push(`工具投影已漂移：${name}`)
    }
  }
  return problems
}
