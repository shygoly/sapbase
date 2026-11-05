#!/usr/bin/env node
/**
 * check-auth-permissions.mjs — 校验 seed 的 PERMISSION_CATALOG 与 @Auth() 声明一致。
 *
 * 为什么需要它：seed 里手写的权限目录会与控制器装饰器漂移。漂移的后果不是编译错误，
 * 而是“seed 成功、演示账号却看不到菜单/调不了接口”。这里把两边对拍，CI fail-closed。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createReporter, loadConfig, parseArgs, printHelp, walkFiles } from './lib/common.mjs'

const opts = parseArgs()
if (opts.help) {
  printHelp(
    'check-auth-permissions.mjs',
    '校验 seed 的 PERMISSION_CATALOG 与 apps/api 的 @Auth() 权限点一致。',
  )
  process.exit(0)
}

let ctx
try {
  ctx = loadConfig(opts.config)
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
const r = createReporter('check-auth-permissions', ctx, opts)

const seedPath = resolve(ctx.repoRoot, 'apps/api/src/seeds/seed.ts')
if (!existsSync(seedPath)) {
  r.err('apps/api/src/seeds/seed.ts', 'seed 文件不存在，无法读取 PERMISSION_CATALOG')
} else {
  const source = readFileSync(seedPath, 'utf8')
  const block = source.match(/const PERMISSION_CATALOG[\s\S]*?\n\]/)?.[0] ?? ''
  const catalog = new Set(
    [...block.matchAll(/name:\s*['"`]([^'"`]+)['"`]/g)].map((match) => match[1]),
  )
  if (catalog.size === 0) {
    r.err('apps/api/src/seeds/seed.ts', 'PERMISSION_CATALOG 为空或无法解析')
  }

  const roots = ctx.config.code.roots.filter((root) => root.startsWith('apps/api/src'))
  const files = roots.flatMap((root) =>
    walkFiles(resolve(ctx.repoRoot, root), {
      extensions: ['.ts'],
      ignoreDirs: ctx.config.code.ignoreDirs,
    }),
  )
  const referenced = new Map()
  for (const file of files) {
    if (file.endsWith('.spec.ts')) continue
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/@Auth\(([^)]*)\)/g)) {
      for (const permission of match[1].matchAll(/['"`]([^'"`]+)['"`]/g)) {
        referenced.set(permission[1], file)
      }
    }
  }

  for (const [permission, file] of referenced) {
    if (!catalog.has(permission)) {
      r.err(
        `${file.replace(`${ctx.repoRoot}/`, '')}:@Auth`,
        `权限点 ${permission} 不在 PERMISSION_CATALOG（seed 会造不出该权限）`,
      )
    }
  }

  r.finish(
    `catalog ${catalog.size} 项，@Auth 引用 ${referenced.size} 项，一致 ${[...referenced.keys()].filter((p) => catalog.has(p)).length} 项`,
  )
}
