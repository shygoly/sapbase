import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

let cachedRoot: string | null = null

/**
 * 解析仓库根目录。
 *
 * 后端以 `npm run start:dev --workspace @sap/api` 启动时 cwd 是 `apps/api/`，
 * 而发布闸门 G0/G4 需要在仓库根执行 `scripts/meta/check-all.mjs` 和
 * `node_modules/jest`，直接用 cwd 会拼出错误路径。
 *
 * 顺序：REPO_ROOT → cwd → 从本文件向上回溯，取第一个含 checker 的目录。
 */
export function resolveRepoRoot(): string {
  if (cachedRoot) return cachedRoot

  const candidates: string[] = []
  if (process.env.REPO_ROOT) candidates.push(resolve(process.env.REPO_ROOT))
  candidates.push(resolve(process.cwd()))

  let dir = __dirname
  for (let i = 0; i < 8; i += 1) {
    candidates.push(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  const found = candidates.find((candidate) =>
    existsSync(resolve(candidate, 'scripts/meta/check-all.mjs')),
  )
  cachedRoot = found ?? resolve(process.cwd())
  return cachedRoot
}
