// 从 Nx project graph 派生边界违规。纯函数、零依赖、可单测。
//
// 为什么需要它：`@nx/enforce-module-boundaries` 的 `onlyDependOnLibsWithTags`
// 只能表达「允许依赖哪些 tag」，表达不了「同层但不同 scope 禁止」；
// 且直接跑 eslint 时若拿不到 ProjectGraph，整条规则会被静默跳过。
// 本模块读 graph JSON 做确定性断言，与 ESLint 规则互补（见 design.md D4）。

const TAG_DIMS = ['type', 'scope', 'layer', 'runtime']

export function tagValue(tags, dim) {
  if (!Array.isArray(tags)) return null
  const prefix = `${dim}:`
  for (const tag of tags) {
    if (typeof tag === 'string' && tag.startsWith(prefix)) return tag.slice(prefix.length)
  }
  return null
}

export const RULES = [
  {
    id: 'B0',
    title: '项目必须声明四类 tag',
    kind: 'node',
    // `type:app` 是组合根，不参与层规则（layer 只描述库）。
    // 且 depConstraints 是 AND 语义：若 app 同时带 layer:app，
    // 会被更严的 `layer:app` 规则约束，导致组合根无法装配 agent/release。
    match: (node) => {
      const required = tagValue(node.tags, 'type') === 'app' ? ['type', 'scope', 'runtime'] : TAG_DIMS
      return required.some((dim) => !tagValue(node.tags, dim))
    },
    detail: (node) => {
      const required = tagValue(node.tags, 'type') === 'app' ? ['type', 'scope', 'runtime'] : TAG_DIMS
      const missing = required.filter((dim) => !tagValue(node.tags, dim))
      return (
        `${node.name} 缺少 tag：${missing.join(', ')}；每个 project.json MUST 声明 ` +
        (required === TAG_DIMS ? 'type/scope/layer/runtime' : 'type/scope/runtime（组合根不声明 layer）') +
        '（docs/ARCHITECTURE.md §2）'
      )
    },
  },
  {
    id: 'B1',
    title: '基座不得依赖业务域',
    kind: 'edge',
    match: (s, t) => tagValue(s.tags, 'layer') === 'platform' && tagValue(t.tags, 'layer') === 'domain',
    detail: (s, t) =>
      `${s.name}（layer:platform）依赖了业务域 ${t.name}（layer:domain）；基座 MUST 保持无业务语义`,
  },
  {
    id: 'B2',
    title: '基座不得依赖前端渲染层',
    kind: 'edge',
    match: (s, t) => tagValue(s.tags, 'layer') === 'platform' && tagValue(t.tags, 'layer') === 'ui',
    detail: (s, t) =>
      `${s.name}（layer:platform）依赖了前端层 ${t.name}（layer:ui）；基座 MUST 可被无浏览器环境装配`,
  },
  {
    id: 'B3',
    title: '业务域之间不得直接依赖',
    kind: 'edge',
    match: (s, t) =>
      tagValue(s.tags, 'layer') === 'domain' &&
      tagValue(t.tags, 'layer') === 'domain' &&
      tagValue(s.tags, 'scope') !== tagValue(t.tags, 'scope'),
    detail: (s, t) =>
      `${s.name}（scope:${tagValue(s.tags, 'scope')}）直接依赖了 ${t.name}` +
      `（scope:${tagValue(t.tags, 'scope')}）；跨域 MUST 走公开入口或事件`,
  },
  {
    id: 'B4',
    title: '浏览器运行时不得依赖 Node 运行时',
    kind: 'edge',
    match: (s, t) =>
      tagValue(s.tags, 'runtime') === 'browser' && tagValue(t.tags, 'runtime') === 'node',
    detail: (s, t) =>
      `${s.name}（runtime:browser）依赖了 ${t.name}（runtime:node)；` +
      `该 import 会拖入 Node 内置模块，浏览器构建 MUST 失败`,
  },
  {
    id: 'B5',
    title: 'Agent 内核不得直达业务实现',
    kind: 'edge',
    match: (s, t) =>
      tagValue(s.tags, 'scope') === 'agent-kernel' &&
      ['app', 'infra'].includes(tagValue(t.tags, 'layer')),
    detail: (s, t) =>
      `${s.name}（scope:agent-kernel）依赖了 ${t.name}（layer:${tagValue(t.tags, 'layer')}）；` +
      `正确路径是端口 + agent-tools 适配器，否则可绕过工具白名单与确认令牌`,
  },
]

function normalizeNodes(graph) {
  const nodes = graph?.graph?.nodes ?? {}
  const out = new Map()
  for (const [name, node] of Object.entries(nodes)) {
    out.set(name, {
      name,
      type: node?.type ?? null,
      root: node?.data?.root ?? null,
      tags: Array.isArray(node?.data?.tags) ? node.data.tags : [],
    })
  }
  return out
}

function normalizeEdges(graph, nodes) {
  const deps = graph?.graph?.dependencies ?? {}
  const edges = []
  for (const [source, list] of Object.entries(deps)) {
    if (!nodes.has(source)) continue
    for (const dep of Array.isArray(list) ? list : []) {
      const target = dep?.target
      if (!target || !nodes.has(target)) continue
      edges.push({ source, target, type: dep?.type ?? 'static' })
    }
  }
  return edges
}

/**
 * @param {any} graph `nx graph --file` 产出的 JSON
 * @returns {{ nodes: object[], edges: object[], violations: object[], summary: object }}
 */
export function evaluateGraph(graph) {
  const nodes = normalizeNodes(graph)
  const edges = normalizeEdges(graph, nodes)
  const violations = []

  for (const node of nodes.values()) {
    for (const rule of RULES) {
      if (rule.kind !== 'node') continue
      if (rule.match(node)) {
        violations.push({
          rule: rule.id,
          title: rule.title,
          source: node.name,
          target: null,
          message: rule.detail(node),
        })
      }
    }
  }

  for (const edge of edges) {
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    for (const rule of RULES) {
      if (rule.kind !== 'edge') continue
      if (rule.match(source, target)) {
        violations.push({
          rule: rule.id,
          title: rule.title,
          source: source.name,
          target: target.name,
          message: rule.detail(source, target),
        })
      }
    }
  }

  violations.sort(
    (a, b) => a.rule.localeCompare(b.rule) || a.source.localeCompare(b.source),
  )

  return {
    nodes: [...nodes.values()],
    edges,
    violations,
    summary: { projects: nodes.size, edges: edges.length, violations: violations.length },
  }
}
