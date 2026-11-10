/**
 * Locale routing unit tests.
 *
 * Run: node tests/locale-routing.test.js
 * Covers the pure decision function used by both app middlewares.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
  },
})

const assert = require('node:assert')
const {
  resolveLocaleRouting,
  shouldSkipLocaleRouting,
} = require('../libs/ui-layout/src/i18n/locale-routing.ts')

const PORTAL_CANONICAL = {
  '/': '/dashboard/overview',
  '/dashboard': '/dashboard/overview',
  '/dashboard/': '/dashboard/overview',
}

const CONSOLE_CANONICAL = {
  '/': '/admin/releases',
  '/admin': '/admin/releases',
  '/admin/': '/admin/releases',
}

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`✓ ${name}`)
  } catch (error) {
    failed += 1
    console.error(`✗ ${name}`)
    console.error(`  ${error.message}`)
  }
}

function route(pathname, query = '', canonical = PORTAL_CANONICAL) {
  return resolveLocaleRouting({
    pathname,
    searchParams: new URLSearchParams(query),
    canonical,
  })
}

test('portal / → /dashboard/overview', () => {
  const decision = route('/')
  assert.strictEqual(decision.action, 'redirect')
  assert.strictEqual(decision.pathname, '/dashboard/overview')
  assert.strictEqual(decision.search, '')
})

test('console / → /admin/releases', () => {
  const decision = route('/', '', CONSOLE_CANONICAL)
  assert.strictEqual(decision.action, 'redirect')
  assert.strictEqual(decision.pathname, '/admin/releases')
})

test('/en → / with locale cookie', () => {
  const decision = route('/en')
  assert.strictEqual(decision.action, 'redirect')
  assert.strictEqual(decision.pathname, '/')
  assert.strictEqual(decision.locale, 'en')
  assert.strictEqual(decision.setCookie, true)
})

test('/en/ → / with locale cookie', () => {
  const decision = route('/en/')
  assert.strictEqual(decision.action, 'redirect')
  assert.strictEqual(decision.pathname, '/')
  assert.strictEqual(decision.locale, 'en')
})

test('/zh/admin/users?x=1 strips prefix and keeps query', () => {
  const decision = route('/zh/admin/users', 'x=1')
  assert.strictEqual(decision.action, 'redirect')
  assert.strictEqual(decision.pathname, '/admin/users')
  assert.strictEqual(decision.search, 'x=1')
  assert.strictEqual(decision.locale, 'zh')
})

test('valid ?lang=ja sets cookie and removes the param', () => {
  const decision = route('/dashboard/overview', 'lang=ja')
  assert.strictEqual(decision.action, 'redirect')
  assert.strictEqual(decision.pathname, '/dashboard/overview')
  assert.strictEqual(decision.search, '')
  assert.strictEqual(decision.locale, 'ja')
  assert.strictEqual(decision.setCookie, true)
})

test('invalid ?lang=xx is ignored and does not set cookie', () => {
  const decision = route('/dashboard/overview', 'lang=xx')
  assert.strictEqual(decision.action, 'redirect')
  assert.strictEqual(decision.pathname, '/dashboard/overview')
  assert.strictEqual(decision.locale, undefined)
  assert.strictEqual(decision.setCookie, false)
})

test('?lang=ja keeps other query params', () => {
  const decision = route('/admin/users', 'page=2&lang=ja')
  assert.strictEqual(decision.search, 'page=2')
})

test('static assets and api are not routed', () => {
  assert.strictEqual(shouldSkipLocaleRouting('/_next/static/chunk.js'), true)
  assert.strictEqual(shouldSkipLocaleRouting('/api/health'), true)
  assert.strictEqual(shouldSkipLocaleRouting('/plugins/x.js'), true)
  assert.strictEqual(shouldSkipLocaleRouting('/images/a.png'), true)
  assert.strictEqual(shouldSkipLocaleRouting('/favicon.ico'), true)
  assert.strictEqual(shouldSkipLocaleRouting('/dashboard/overview'), false)
})

test('plain path passes through', () => {
  const decision = route('/login')
  assert.strictEqual(decision.action, 'next')
})

test('non-locale first segment is not stripped', () => {
  const decision = route('/english/dashboard')
  assert.strictEqual(decision.action, 'next')
})

console.log(`\nPassed: ${passed}`)
console.log(`Failed: ${failed}`)

if (failed > 0) process.exitCode = 1
