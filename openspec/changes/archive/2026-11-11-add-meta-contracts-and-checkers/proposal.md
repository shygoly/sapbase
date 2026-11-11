# Change: 建立四份机器可校验契约与 Checker（P0）

> 执行顺序：**1 / 8**
> 依赖：无
> 参考：`docs/reference/01-meta-model.md`、`03-contracts.md`、`07-adoption-and-checks.md` §P0

## Why

`docs/META_LANGUAGE.md` 已经定义了元模型与不变量，但仓库根目录没有
`DOMAIN.md` / `FLOWS.md` / `DECISIONS.md` / `AGENT-TOOLS.md` 四份机器可校验契约，
也没有任何脚本能发现“表加了但文档没加”“cron 改名了但文档没改”“代码写了 `D-x` 但决策册没登记”
这类漂移。参考包已经给出零依赖 checker 与模板，本变更负责把它们落到 sapbase 现状上。

这一层只做**只读校验**：不改业务逻辑、不改数据库结构、不改运行时行为。

## What Changes

- **ADDED** 根目录四份契约：`DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`、`AGENT-TOOLS.md`
- **ADDED** `contracts/schema-manifest.json`：从现有 TypeORM 实体生成的表/列清单（提交入库）
- **ADDED** `scripts/meta/`：三个 checker、`check-all.mjs`、`lib/common.mjs`、TypeORM manifest 生成器
- **ADDED** `meta.config.json`、`meta-baseline.json`
- **ADDED** 根 `package.json` 的 `check:domain` / `check:meta` / `check:agent-tools` / `check:all` / `check:ci`
- **ADDED** CI 只读校验步骤：先 `--warn-only`，存量问题进基线
- **ADDED** 现有唯一 cron 的集中 registry 与 `@Cron(..., { name })`，满足三向对拍
- **MODIFIED** 根 `AGENTS.md`：增加“元语入口 / DOMAIN RULE / META RULE / AGENT RULE”段

**BREAKING**：无。checker 只读，不阻断运行时；CI 初期只告警。

## Impact

- Affected specs: `meta-contracts`（新增）
- Affected code:
  - 根目录：`DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`、`AGENT-TOOLS.md`、`meta.config.json`、`meta-baseline.json`
  - `contracts/schema-manifest.json`
  - `scripts/meta/*`
  - `package.json`、`.github/workflows/ci.yml`、`AGENTS.md`
  - `backend/src/semantic-runtime/suggestion-cron.ts`（只补 `name`）
  - `backend/src/monitor/scheduled-job.registry.ts`（新建）

## Out of Scope

- 不把 checker 转为 error 级阻断（本变更只用 `--warn-only` + 基线）
- 不做 Nx 迁移（见变更 2）
- 不实现 Release / PiAgent 新能力（见变更 3–7）
- 不修改 `docs/META_LANGUAGE.md` 的真源地位，也不合并参考包（见变更 8）
