# Change: 合并参考包到文档真源并消除双真源（P5）

> 执行顺序：**8 / 8**
> 依赖：变更 1–7 已完成并稳定
> 参考：`docs/reference/07-adoption-and-checks.md` §8

## Why

`docs/reference/` 是采用期的参考包，`docs/META_LANGUAGE.md` 仍是当前真源。
如果两份文本长期并行，Agent 和评审者会读到互相矛盾的规则：
例如发布不变量只在参考包里有，或 PiAgent 边界只在参考文档里写。

参考包明确要求：一旦内容被并入真源，就标记“已并入”并从参考包中删除，
避免两份文本长期并行。本变更负责最后的文档归并。

## What Changes

- **MODIFIED** `docs/META_LANGUAGE.md`：吸收 Release / PiAgent / 进化闭环的术语与不变量
- **ADDED** `docs/ARCHITECTURE.md`：由 `02-architecture.md` 归并而来
- **ADDED** `docs/protocols/release.md`：由 `04-versioning-release.md` 归并而来
- **ADDED** `docs/protocols/piagent.md`：由 `05-piagent.md` 归并而来
- **ADDED** `docs/protocols/agent-evolution.md`：由 `06-evolution-loop.md` 归并而来
- **MODIFIED** `CONTRIBUTING.md`：并入采用/CI/PR 检查流程
- **MODIFIED** 根 `AGENTS.md`：只指向真源，不再把参考包当第二入口
- **MODIFIED** `openspec/project.md`：补充 Nx、四契约、Release/PiAgent 协议的真实状态
- **MODIFIED** `docs/reference/README.md`：标记“已并入，保留作历史”
- **REMOVED** 参考包中被并入的 01–07、templates、scripts 副本（保留 `reference.zip` 作历史归档）
- **ADDED** 季度文档漂移审计清单

**BREAKING**：无运行时影响；只影响文档入口与真源。

## Impact

- Affected specs: `documentation-governance`（新增）
- Affected docs/code:
  - `docs/META_LANGUAGE.md`、`docs/ARCHITECTURE.md`、`docs/protocols/*`
  - `CONTRIBUTING.md`、`AGENTS.md`、`openspec/project.md`
  - `docs/reference/**`
  - `scripts/meta/README.md`（引用路径更新）

## Out of Scope

- 不修改任何运行时代码
- 不重新定义参考包的架构决策；只归并已在变更 1–7 落地的内容
- 不删除 `docs/reference.zip`（历史归档）
