<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## 项目元语（必读）

进入本项目时，除上述 OpenSpec 说明外，请先读这两份**元上下文**：

1. [`docs/META_LANGUAGE.md`](./docs/META_LANGUAGE.md) —— 项目元语：元模型 `Ω`、五个核心协议、
   执行原语（原子契约 / ABI / 准入闸 / Capsule / Space Delta）、**不变量**、术语表与文档真源。
   领域命名以它的术语表为准，不要另造同义词。
2. [`openspec/project.md`](./openspec/project.md) —— 项目上下文：技术栈、约定、领域边界与硬性约束。

元语对**所有**请求都适用，包括按 [`openspec/AGENTS.md`](./openspec/AGENTS.md) 走规划/提案流程时。
各子系统的结构化描述文档不在本文件逐条罗列，统一由元语第 5.2 节的文档真源表索引；
在子目录内工作时，入口是同目录的 `AGENTS.md`（如 [`apps/api/AGENTS.md`](./apps/api/AGENTS.md)）。

两条最容易踩的规则：

- 新增能力 / 破坏性变更先立 OpenSpec change proposal，批准后再实现（元语不变量 10）。
- 包管理器只允许 **npm**，唯一锁文件是根 `package-lock.json`（见 [`docs/PACKAGE_MANAGER.md`](./docs/PACKAGE_MANAGER.md)）。

## 元语入口（机器可校验契约）

进入项目后，除上述元上下文外，还必须把根目录四份契约当作机器可校验真源：

- [`DOMAIN.md`](./DOMAIN.md) —— 表/列/关系/不变量；改表或改 `app-*` / `domain-*` 服务前先读对应 `##` 小节。
- [`FLOWS.md`](./FLOWS.md) —— cron 与业务线；改 cron 必须同步 FLOWS + registry + `@Cron(name:)`。
- [`DECISIONS.md`](./DECISIONS.md) —— `D-x` 架构决策；代码里的独立 `D-x` 标记必须登记。
- [`AGENT-TOOLS.md`](./AGENT-TOOLS.md) —— 与 `contracts/tools.json` 对拍；写工具必须 `confirmation: required`。

**DOMAIN RULE**：改任何 `biz_` / `app_` / `agent_` / `sys_` 表、实体或 `app-*` / `domain-*` 服务前，先读 `DOMAIN.md` 对应 `##` 小节（切片读取，勿全文加载）。改关系/级联/状态词必须同步该节，并跑 `node scripts/meta/check-domain-doc.mjs`。

**META RULE**：四份契约机器可校验。
- `FLOWS.md`：改 cron 必须同步 FLOWS + registry + `@Cron(name:)`，跑 `check-meta-docs.mjs`。
- `DECISIONS.md`：代码里的独立 `D-x` 标记必须登记（`TD-x` 在 `docs/tech-debt.md`）。
- `AGENT-TOOLS.md`：与 `contracts/tools.json` 对拍；写工具必须 `confirmation: required`。
- `DOMAIN.md`：表/列/关系/不变量；跑 `check-domain-doc.mjs`。
- `docs/OPENSPEC_CHANGES.md`：change 台账；改 `openspec/changes/**` 后跑 `npm run meta:openspec-ledger`，CI 会校验；交互浏览用 `openspec view`。

**AGENT RULE**：PiAgent 只能经 `contracts/tools.json` 的工具面操作；写操作必须确认令牌；不得批准/发布自己起草的提议；不得把未发布知识带入回答。

## 工程参考与协议真源

- 工程架构：[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- 发布/激活/回退：[`docs/protocols/release.md`](./docs/protocols/release.md)
- PiAgent：[`docs/protocols/piagent.md`](./docs/protocols/piagent.md)
- Agent 进化闭环：[`docs/protocols/agent-evolution.md`](./docs/protocols/agent-evolution.md)
- `docs/reference/` 为历史归档，不是入口，不参与校验；冲突时以 `docs/META_LANGUAGE.md` 为准。
