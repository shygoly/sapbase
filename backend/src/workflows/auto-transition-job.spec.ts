// W1-0 护栏：自动迁移 job **只能有一个来源，而且必须真的被装配**。
//
// 为什么要有这条：W0 清点时发现 `backend/src/workflows/workflow-auto-transition.job.ts`
// 没有任何导入者（死文件），却带着 `@Cron('0 2 * * *')`。这种"多出来的 job"不报错、
// 不失败、也测不出来 —— 它只会让自动建议在某天悄悄跑两遍。单测和 e2e 都看不见它，
// 因为没有人会去数 cron 触发了几次。所以这里用源码扫描把这个不变量钉死：
// **一个 job 文件、一处 cron 表达式、一个注册它的模块**。
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SRC_ROOT = join(__dirname, '..')
const CRON = "@Cron('0 2 * * *')"
const JOB_BASENAME = 'workflow-auto-transition.job.ts'
/** 唯一被允许存在的那个 job（`workflow-context` 侧；用的是 API 同一个建议实现）。 */
const LIVE_JOB = 'workflow-context/infrastructure/jobs/workflow-auto-transition.job.ts'

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

const rel = (file: string): string => relative(SRC_ROOT, file).split(sep).join('/')
const SOURCES = walk(SRC_ROOT).filter(
  (file) => !file.endsWith('.spec.ts') && !file.endsWith('.e2e-spec.ts'),
)

describe('自动迁移 job 的唯一性（W1-0 护栏）', () => {
  it('全仓只有一个 workflow-auto-transition.job 源文件，且是已装配的那个', () => {
    const jobs = SOURCES.filter((file) => file.endsWith(JOB_BASENAME)).map(rel)
    expect(jobs).toEqual([LIVE_JOB])
  })

  it('02:00 的 cron 表达式全仓只出现一处，就在那个 job 里', () => {
    const withCron = SOURCES.filter((file) => readFileSync(file, 'utf8').includes(CRON)).map(rel)
    expect(withCron).toEqual([LIVE_JOB])
  })

  it('恰好一个模块导入它，并且把它写进 providers（导入但不注册 = 永远不会跑）', () => {
    const modules = SOURCES.filter(
      (file) =>
        file.endsWith('.module.ts') &&
        readFileSync(file, 'utf8').includes('workflow-auto-transition.job'),
    ).map(rel)
    expect(modules).toEqual(['workflow-context/workflow-context.module.ts'])

    const moduleSource = readFileSync(join(SRC_ROOT, modules[0]), 'utf8')
    expect(moduleSource).toMatch(/providers:\s*\[[\s\S]*WorkflowAutoTransitionJob/)
  })
})
