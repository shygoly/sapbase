/**
 * 公告正文安全渲染测试（XSS / Markdown 子集 / 附件协议）。
 *
 * Run: node --test tests/notification-center.test.js
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true, jsx: 'react-jsx' },
})
const tsconfig = require('../tsconfig.base.json')
require('tsconfig-paths').register({
  baseUrl: tsconfig.compilerOptions.baseUrl,
  paths: tsconfig.compilerOptions.paths,
})

const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const {
  AnnouncementBody,
  AnnouncementAttachments,
} = require('../libs/app-shared/src/components/announcement-body')

test('XSS：script/img onerror 只作为文本，不生成 HTML 标签', () => {
  const html = renderToStaticMarkup(
    React.createElement(AnnouncementBody, {
      body: '<script>alert(1)</script>\n<img src=x onerror=alert(2)>',
    }),
  )
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /<img/i)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('Markdown 子集：粗体/斜体/行内代码/安全链接', () => {
  const html = renderToStaticMarkup(
    React.createElement(AnnouncementBody, {
      body: '**重点** 和 *斜体* 和 `code` 和 [官网](https://example.com)',
    }),
  )
  assert.match(html, /<strong>重点<\/strong>/)
  assert.match(html, /<em>斜体<\/em>/)
  assert.match(html, /<code[^>]*>code<\/code>/)
  assert.match(html, /href="https:\/\/example\.com\/?"/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener noreferrer"/)
})

test('危险协议链接降级为纯文本', () => {
  const html = renderToStaticMarkup(
    React.createElement(AnnouncementBody, {
      body: '[点我](javascript:alert(1)) [data](data:text/html,<script>1</script>)',
    }),
  )
  assert.doesNotMatch(html, /href="javascript:/i)
  assert.doesNotMatch(html, /href="data:/i)
  assert.match(html, /\[点我\]\(javascript:alert\(1\)\)/)
})

test('标题/列表/代码块渲染', () => {
  const html = renderToStaticMarkup(
    React.createElement(AnnouncementBody, {
      body: '# 标题\n- 第一项\n- 第二项\n\n```\nconst a = 1\n```',
    }),
  )
  assert.match(html, /<h2[^>]*>标题<\/h2>/)
  assert.match(html, /<ul[^>]*>.*第一项.*第二项/s)
  assert.match(html, /<pre[^>]*>const a = 1<\/pre>/)
})

test('附件：只渲染 http/https', () => {
  const html = renderToStaticMarkup(
    React.createElement(AnnouncementAttachments, {
      attachments: [
        { name: '课程表.pdf', url: 'https://example.com/a.pdf' },
        { name: '坏链接', url: 'javascript:alert(1)' },
        { name: '相对路径', url: '/etc/passwd' },
      ],
    }),
  )
  assert.match(html, /课程表\.pdf/)
  assert.match(html, /href="https:\/\/example\.com\/a\.pdf"/)
  assert.doesNotMatch(html, /坏链接/)
  assert.doesNotMatch(html, /相对路径/)
  assert.doesNotMatch(html, /javascript:/i)
})
