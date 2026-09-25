# 包管理器约定

> 日期：2026-09-24
> 相关：[TECH_STACK_GAP.md](./TECH_STACK_GAP.md) §9（附带发现）、[TECH_STACK_v2.md](./TECH_STACK_v2.md)（前端依赖核对）

## 结论

**本仓库统一使用 npm，唯一锁文件是根目录 `package-lock.json`。**

不再使用 pnpm / yarn / bun，也不在子包内单独维护锁文件。

## 为什么是 npm

| 依据 | 说明 |
| --- | --- |
| 已提交的事实 | 根 `package-lock.json` 一直是唯一被跟踪的根锁文件 |
| 工作区声明 | 根 `package.json` 的 `workspaces`（npm workspaces 原生支持） |
| CI 现状 | 模板 CI 的 `npm ci` 路径是唯一与已提交锁文件匹配的路径 |
| 子包锁文件的矛盾 | `speckit/bun.lock` 曾存在于一个 npm workspace 成员内部 —— 两套解析结果必然漂移 |

pnpm 与 yarn 的配置文件在多处出现，但它们从未进入版本控制，属于本地实验残留。

## 本次清理

| 项 | 处理 | 可恢复性 |
| --- | --- | --- |
| `speckit/bun.lock` | 删除（原为 git 跟踪） | ✅ `git restore speckit/bun.lock` |
| `speckit/package.json` 的 `lint:fix: ... && bun format` | 改为 `prettier --write .` | ✅ git diff 可见 |
| `speckit/.npmrc` 的 `shamefully-hoist=true`（pnpm 专有键）与 pnpm 注释 | 移除，保留 `legacy-peer-deps=true` 并加注原因 | ✅ git diff 可见 |
| `pnpm-lock.yaml`、`pnpm-workspace.yaml`（未跟踪） | **移出仓库**到 `~/Downloads/sapbase-pm-backup/` | ✅ 原地未删，移回即可 |
| `speckit/README.md` 的 `bun install` / `bun run dev` | 改为 npm 命令，并标注该 README 其余部分仍是上游模板原文 | ✅ git diff 可见 |
| `.github/workflows/ci.yml` 的四包管理器 × 三平台矩阵 | 改为 npm-only，并补上产品代码的构建与测试 | ✅ git diff 可见 |

## 日常命令

```bash
# 安装（始终在仓库根目录执行）
npm install

# 开发：前后端一起起
npm run dev

# 只起一端
npm run dev:frontend
npm run dev:backend

# 构建 / 测试 / 检查
npm run build
npm run lint
npm run test --workspace backend

# Wasm 原子模块
npm run wasm:build
npm run wasm:test
npm run wasm:admit -- --source modules/available-inventory-rust --atomic-type available-inventory
```

## 迁移说明（需要执行一次）

当前工作区的 `node_modules` 形态不统一：根目录曾用 pnpm 装过（有 `node_modules/.pnpm`），
`backend/` 与 `speckit/` 各自装过。收敛后建议做一次干净安装：

```bash
# 1) 备份（可选）
mv node_modules node_modules.bak

# 2) 干净安装（会用 package-lock.json 重建整棵依赖树）
npm ci

# 3) 验证
npm run build --workspace shared-schemas
npm run wasm:build && npm run wasm:test
npm run build --workspace backend
```

若 `npm ci` 报锁文件与 `package.json` 不一致（新增 workspace `wasm-modules` 后可能出现），
改用 `npm install` 让 npm 更新锁文件并提交结果。

## 新增 workspace 时的注意事项

1. 在根 `package.json` 的 `workspaces` 里登记目录；
2. 不要在该目录下放锁文件；
3. 依赖一律在**根目录**安装（npm workspaces 会提升）；
4. 子包 `package.json` 里声明自己的 `devDependencies`（如 `wasm-modules` 的 `typescript`），
   但不要在子包内执行 `npm install`。

## 已知遗留

- ~~`node_modules` 尚未做干净重建~~ **已完成（2026-09-25）**：执行 `npm install`（1502 包），
  之后 `backend` 类型检查错误 18 → **0**、`nest build` 通过、`next build` 通过、全部测试保持全绿。
  过程中修掉两个被缺依赖掩盖的真实问题：种子脚本写错字段名（`password` → `passwordHash`）、
  `/login` 页面缺 `useSearchParams()` 的 Suspense 边界导致预渲染失败。
- ~~CI 的 `apps` job 设 `continue-on-error: true`~~ **已转强制门禁（2026-09-25）**。
- 历史文档（`DATABASE_SETUP.md`、`docs/zh-CN/**`、`docs/zh-TW/**`）仍存在 markdownlint
  既存问题，暂未纳入 CI 的文档检查范围。
- 根 `README.md` 的下半部分是上游模板 README 原文（含裸 URL 等既存问题），
  暂未纳入 CI 的文档检查范围。
- `openspec/changes/**` 的历史变更文档同样有既存 lint 问题（MD009 / MD024 / MD058），
  暂未纳入 CI；新增的 `add-wasm-atomic-runtime` 本身已通过 lint。
- **后端类型检查当前不通过**（`tsc -p backend/tsconfig.json --noEmit` 报 20+ 错），
  根因是依赖未干净安装：缺 `dotenv`、`socket.io`、`@types/semver`，
  以及 `node_modules` 仍是 pnpm/npm/bun 混合形态。执行上面的 `npm ci` 应能消除；
  在此之前 CI 的 `apps` job 保持 `continue-on-error: true`。
