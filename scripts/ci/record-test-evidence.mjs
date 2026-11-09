import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const input = process.env.JEST_RESULT_FILE ?? 'test-results/jest.json'
const apiBase = (process.env.SAPBASE_API_URL ?? 'http://localhost:3051').replace(/\/$/, '')
const token = process.env.SAPBASE_CI_TOKEN
const appKey = process.env.SAPBASE_APP_KEY ?? 'erp-purchase'

if (!existsSync(input)) {
  console.error(`[evidence] missing jest result: ${input}`)
  process.exit(1)
}

const raw = readFileSync(input)
const digest = `sha256:${createHash('sha256').update(raw).digest('hex')}`
const parsed = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''))
const suiteSummary = {
  suites: parsed.numTotalTestSuites ?? parsed.testResults?.length ?? 0,
  tests: parsed.numTotalTests ?? 0,
  passed: parsed.numPassedTests ?? 0,
  failed: parsed.numFailedTests ?? 0,
  success: parsed.success === true,
}

let commitSha = process.env.GIT_COMMIT_SHA ?? null
if (!commitSha) {
  try {
    commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    commitSha = null
  }
}

const payload = {
  appKey,
  commitSha,
  suiteSummary,
  jestOutputDigest: digest,
  ranAt: new Date().toISOString(),
}

mkdirSync('test-results', { recursive: true })
writeFileSync('test-results/test-evidence.json', JSON.stringify(payload, null, 2))

if (!token) {
  console.warn('[evidence] SAPBASE_CI_TOKEN not set; wrote test-results/test-evidence.json and skipped API registration')
  process.exit(0)
}

const response = await fetch(`${apiBase}/api/builder/test-evidence`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
})

if (!response.ok) {
  console.error(`[evidence] registration failed: ${response.status} ${(await response.text()).slice(0, 300)}`)
  process.exit(1)
}

console.log(`[evidence] registered ${digest}`)
