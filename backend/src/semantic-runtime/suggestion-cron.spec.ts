/**
 * 夜间建议：准入纯函数 + cron 只写日志 + 源码护栏（@Cron 恰好一处）。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { SuggestionCronJob } from './suggestion-cron'
import { selectAutoSuggestTargets, type AutoSuggestPackage } from './suggestion-targets'

const SRC_ROOT = join(__dirname, '..')
const CRON = "@Cron('0 2 * * *')"
const LIVE_JOB = 'semantic-runtime/suggestion-cron.ts'

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

const pkg: AutoSuggestPackage = {
  packageId: 'pkg',
  blueprintId: 'bp',
  entities: [
    {
      name: 'Order',
      autoSuggest: true,
      states: [{ name: 'draft' }, { name: 'closed', final: true }],
    },
    { name: 'Part', states: [{ name: 'active' }] },
  ],
}

describe('selectAutoSuggestTargets', () => {
  it('标了准入且非终态（含未写 state）→ 入选', () => {
    expect(
      selectAutoSuggestTargets(
        [pkg],
        [
          { id: 'r1', blueprintId: 'bp', entity: 'Order', organizationId: 'org-1', state: 'draft' },
          { id: 'r0', blueprintId: 'bp', entity: 'Order', organizationId: 'org-1', state: null },
        ],
      ),
    ).toEqual([
      {
        packageId: 'pkg',
        blueprintId: 'bp',
        entity: 'Order',
        recordId: 'r1',
        organizationId: 'org-1',
      },
      {
        packageId: 'pkg',
        blueprintId: 'bp',
        entity: 'Order',
        recordId: 'r0',
        organizationId: 'org-1',
      },
    ])
  })

  it('未标或已终态 → 不入选', () => {
    expect(
      selectAutoSuggestTargets(
        [pkg],
        [
          { id: 'r2', blueprintId: 'bp', entity: 'Order', organizationId: 'org-1', state: 'closed' },
          { id: 'r3', blueprintId: 'bp', entity: 'Part', organizationId: 'org-1', state: 'active' },
        ],
      ),
    ).toEqual([])
  })
})

describe('SuggestionCronJob', () => {
  function harness(suggestions: Array<{ to: string }>) {
    const transition = jest.fn()
    const listAutoSuggestTargets = jest.fn(async () => [
      {
        packageId: 'pkg',
        blueprintId: 'bp',
        entity: 'Order',
        recordId: 'r1',
        organizationId: 'org-1',
      },
    ])
    const listSuggestedTransitions = jest.fn(async () => suggestions)
    const save = jest.fn(async (row: unknown) => row)
    const cron = new SuggestionCronJob(
      { listAutoSuggestTargets, listSuggestedTransitions, transition } as never,
      { save } as never,
    )
    return { cron, transition, save }
  }

  it('有建议 → 写第一条且 reason 为空，不调用 transition', async () => {
    const { cron, transition, save } = harness([{ to: 'confirmed' }])
    await cron.run()
    expect(transition).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({
      blueprintId: 'bp',
      entity: 'Order',
      recordId: 'r1',
      organizationId: 'org-1',
      suggestedToState: 'confirmed',
      reason: null,
    })
  })

  it('建议为空 → 不写，也不调用 transition', async () => {
    const { cron, transition, save } = harness([])
    await cron.run()
    expect(save).not.toHaveBeenCalled()
    expect(transition).not.toHaveBeenCalled()
  })
})

describe('夜间建议 cron 的唯一性', () => {
  it('02:00 的 cron 表达式全仓只出现一处，就在建议 job 里', () => {
    const withCron = SOURCES.filter((file) => readFileSync(file, 'utf8').includes(CRON)).map(rel)
    expect(withCron).toEqual([LIVE_JOB])
  })

  it('恰好一个模块把它写进 providers', () => {
    const modules = SOURCES.filter(
      (file) => file.endsWith('.module.ts') && readFileSync(file, 'utf8').includes('SuggestionCronJob'),
    ).map(rel)
    expect(modules).toEqual(['semantic-runtime/semantic-runtime.module.ts'])
    const moduleSource = readFileSync(join(SRC_ROOT, modules[0]), 'utf8')
    expect(moduleSource).toMatch(/providers:\s*\[[\s\S]*SuggestionCronJob/)
  })
})
