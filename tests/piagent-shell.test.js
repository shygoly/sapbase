/**
 * PiAgent 壳层助手纯函数测试：帮助/代操快捷语、上下文芯片注入。
 *
 * Run: node --test tests/piagent-shell.test.js
 */

const test = require('node:test')
const assert = require('node:assert/strict')

// 纯 TS 模块，用 ts-node 转译；不加载 React/Next 组件，避免浏览器依赖。
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true },
})

const {
  ACTION_PROMPTS,
  HELP_PROMPTS,
  buildContextSuffix,
  quickPrompts,
} = require('../libs/app-shared/src/components/piagent/context')

test('帮助模式快捷语是只读意图', () => {
  assert.deepEqual(quickPrompts('help'), HELP_PROMPTS)
  assert.ok(HELP_PROMPTS.some((prompt) => prompt.includes('怎么用')))
  assert.ok(HELP_PROMPTS.every((prompt) => !prompt.includes('创建')))
})

test('协助模式快捷语包含写操作，且明确先确认', () => {
  assert.deepEqual(quickPrompts('action'), ACTION_PROMPTS)
  assert.ok(ACTION_PROMPTS.some((prompt) => prompt.includes('确认卡')))
})

test('上下文芯片注入 org/app/route/entity', () => {
  const suffix = buildContextSuffix([
    { key: 'org', label: '组织：A', value: 'org-1' },
    { key: 'app', label: '应用：sapbase', value: 'sapbase' },
    { key: 'route', label: '路由：/dashboard', value: '/dashboard' },
    { key: 'entity', label: '实体：r1', value: 'r1' },
  ])
  assert.match(suffix, /\[context org=org-1 app=sapbase route=\/dashboard entity=r1\]/)
})

test('移除所有上下文后不注入空上下文', () => {
  assert.equal(buildContextSuffix([]), '')
})
