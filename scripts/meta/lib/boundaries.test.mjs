import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateGraph, tagValue, RULES } from './boundaries.mjs'

/** 构造最小 graph：nodes = { name: [tags] }，deps = { source: [target] } */
function graphOf(nodes, deps = {}) {
  const graphNodes = {}
  for (const [name, tags] of Object.entries(nodes)) {
    graphNodes[name] = { name, type: 'lib', data: { root: `libs/${name}`, tags } }
  }
  const dependencies = {}
  for (const name of Object.keys(nodes)) {
    dependencies[name] = (deps[name] ?? []).map((target) => ({
      source: name,
      target,
      type: 'static',
    }))
  }
  return { graph: { nodes: graphNodes, dependencies } }
}

const platform = ['type:lib', 'scope:platform', 'layer:platform', 'runtime:node']
const shipping = ['type:lib', 'scope:shipping', 'layer:domain', 'runtime:node']
const finance = ['type:lib', 'scope:finance', 'layer:domain', 'runtime:node']
const kit = ['type:lib', 'scope:shared', 'layer:ui', 'runtime:browser']
const kernel = ['type:lib', 'scope:agent-kernel', 'layer:agent', 'runtime:node']

function rulesOf(result) {
  return result.violations.map((v) => v.rule)
}

test('tagValue 取到对应维度，缺失返回 null', () => {
  assert.equal(tagValue(['type:lib', 'scope:shipping'], 'scope'), 'shipping')
  assert.equal(tagValue(['type:lib'], 'runtime'), null)
  assert.equal(tagValue(undefined, 'type'), null)
  // npm 自动 tag 不参与四类维度判定
  assert.equal(tagValue(['npm:private', 'type:lib'], 'npm'), 'private')
  assert.equal(tagValue(['npm:private', 'type:lib'], 'type'), 'lib')
})

test('干净图：零违规', () => {
  const result = evaluateGraph(
    graphOf(
      { 'platform-core': platform, 'ui-kit': kit, 'domain-shipping': shipping },
      { 'domain-shipping': ['platform-core'], 'platform-core': [] },
    ),
  )
  assert.deepEqual(result.violations, [])
  assert.equal(result.summary.projects, 3)
  assert.equal(result.summary.edges, 1)
})

test('B0：缺 tag 被报出，且指明缺哪一维', () => {
  const result = evaluateGraph(graphOf({ broken: ['type:lib', 'layer:ui'] }))
  assert.deepEqual(rulesOf(result), ['B0'])
  assert.match(result.violations[0].message, /scope, runtime/)
})

test('B0：type:lib 缺 layer 也算违规', () => {
  const result = evaluateGraph(graphOf({ nolayer: ['type:lib', 'scope:shared', 'runtime:node'] }))
  assert.deepEqual(rulesOf(result), ['B0'])
  assert.match(result.violations[0].message, /layer/)
})

test('B0 反例：组合根（type:app）不声明 layer 是合法的', () => {
  const api = ['type:app', 'scope:api', 'runtime:node']
  const result = evaluateGraph(
    graphOf({ api, 'release-kernel': ['type:lib', 'scope:shared', 'layer:release', 'runtime:node'] }, {
      api: ['release-kernel'],
    }),
  )
  assert.deepEqual(result.violations, [])
})

test('B1：基座依赖业务域', () => {
  const result = evaluateGraph(
    graphOf({ 'platform-core': platform, 'domain-shipping': shipping }, {
      'platform-core': ['domain-shipping'],
    }),
  )
  assert.deepEqual(rulesOf(result), ['B1'])
  assert.equal(result.violations[0].source, 'platform-core')
  assert.equal(result.violations[0].target, 'domain-shipping')
})

test('B2：基座依赖前端层', () => {
  const result = evaluateGraph(
    graphOf({ 'platform-core': platform, 'ui-kit': kit }, {
      'platform-core': ['ui-kit'],
    }),
  )
  assert.deepEqual(rulesOf(result), ['B2'])
})

test('B3：业务域跨 scope 依赖', () => {
  const result = evaluateGraph(
    graphOf({ 'domain-shipping': shipping, 'domain-finance': finance }, {
      'domain-shipping': ['domain-finance'],
    }),
  )
  assert.deepEqual(rulesOf(result), ['B3'])
})

test('B3 反例：同 scope 的域内拆分允许', () => {
  const shippedCore = ['type:lib', 'scope:shipping', 'layer:domain', 'runtime:node']
  const result = evaluateGraph(
    graphOf({ 'domain-shipping': shipping, 'domain-shipping-core': shippedCore }, {
      'domain-shipping': ['domain-shipping-core'],
    }),
  )
  assert.deepEqual(result.violations, [])
})

test('B4：浏览器运行时依赖 Node 运行时', () => {
  const result = evaluateGraph(
    graphOf({ 'ui-kit': kit, 'domain-shipping': shipping }, {
      'ui-kit': ['domain-shipping'],
    }),
  )
  // ui-kit 同时踩 B4（runtime）+ 无 domain 规则；此处只断言 B4 在列
  assert.ok(rulesOf(result).includes('B4'))
})

test('B5：Agent 内核直达业务实现（layer:app）', () => {
  const appLayer = ['type:lib', 'scope:shipping', 'layer:app', 'runtime:node']
  const result = evaluateGraph(
    graphOf({ 'agent-kernel': kernel, 'app-shipping': appLayer }, {
      'agent-kernel': ['app-shipping'],
    }),
  )
  assert.deepEqual(rulesOf(result), ['B5'])
})

test('B5 反例：agent-kernel 依赖 shared 与纯规则域允许', () => {
  const shared = ['type:lib', 'scope:shared', 'layer:shared', 'runtime:isomorphic']
  const result = evaluateGraph(
    graphOf(
      { 'agent-kernel': kernel, 'shared-core': shared, 'domain-shipping': shipping },
      { 'agent-kernel': ['shared-core', 'domain-shipping'] },
    ),
  )
  // domain 是纯规则、无 IO，agent-kernel 可以依赖；只有 app/infra 才禁止
  assert.deepEqual(result.violations, [])
})

test('指向图外节点的边被忽略，不产生幻影违规', () => {
  const result = evaluateGraph(
    graphOf({ 'platform-core': platform }, { 'platform-core': ['does-not-exist'] }),
  )
  assert.deepEqual(result.violations, [])
  assert.equal(result.summary.edges, 0)
})

test('多条规则同时命中时全部报出', () => {
  const result = evaluateGraph(
    graphOf({ 'platform-core': platform, 'domain-shipping': shipping, 'ui-kit': kit }, {
      'platform-core': ['domain-shipping', 'ui-kit'],
    }),
  )
  assert.deepEqual(rulesOf(result).sort(), ['B1', 'B2'])
})

test('规则 id 唯一', () => {
  const ids = RULES.map((r) => r.id)
  assert.equal(new Set(ids).size, ids.length)
})
