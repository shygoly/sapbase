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
在子目录内工作时，入口是同目录的 `AGENTS.md`（如 [`speckit/AGENTS.md`](./speckit/AGENTS.md)、[`backend/AGENTS.md`](./backend/AGENTS.md)）。

两条最容易踩的规则：

- 新增能力 / 破坏性变更先立 OpenSpec change proposal，批准后再实现（元语不变量 10）。
- 包管理器只允许 **npm**，唯一锁文件是根 `package-lock.json`（见 [`docs/PACKAGE_MANAGER.md`](./docs/PACKAGE_MANAGER.md)）。
