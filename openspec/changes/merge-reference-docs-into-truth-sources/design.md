## Context

变更 1–7 已经把参考包的四契约、Nx 边界、Release、Runtime、Knowledge/Eval、Builder 与 A2 落到代码与根契约。
此时 `docs/reference/` 仍保留同一批内容的原始叙述，容易与真源分叉。

参考包的维护规则：

> 一旦某份内容被并入根目录真源，就在此标注“已并入”并从参考包中删除，
> 避免两份文本长期并行。

## Goals / Non-Goals

- Goals
  - 每个主题只有一份权威文本
  - 根 `AGENTS.md` 只指向真源
  - `docs/reference/README.md` 明确标注历史状态
  - 归并后的文档仍可被 checker 与评审使用
- Non-Goals
  - 不重写已落地的技术决策
  - 不保留两套互相解释的长文
  - 不删除 `reference.zip` 历史归档

## Decisions

- Decision: `docs/META_LANGUAGE.md` 吸收术语与跨领域不变量（INV-REL / INV-AGENT / INV-EVO）。
- Decision: 工程结构归并到 `docs/ARCHITECTURE.md`，而不是塞进 `openspec/project.md`。
  - `openspec/project.md` 只保留项目上下文与入口摘要。
- Decision: 发布、PiAgent、进化闭包各自独立为 `docs/protocols/*.md`，与既有 `chat-erp.md` 平级。
- Decision: 参考包 `01-07`、`templates/`、`scripts/` 在归并完成后删除；`reference.zip` 保留作历史归档。
  - 理由：提取目录是可被 Agent 读取的并行真源；zip 不是入口。
- Decision: 增加季度审计清单，检查术语漂移、重复契约、死链与入口分叉。

## Merge Map

| 参考包 | 并入 |
|---|---|
| `01-meta-model.md` 术语/不变量 | `docs/META_LANGUAGE.md` §4/§6 |
| `02-architecture.md` | `docs/ARCHITECTURE.md` |
| `03-contracts.md` | 根四契约的“附录：格式契约” + `docs/ARCHITECTURE.md` |
| `04-versioning-release.md` | `docs/protocols/release.md` |
| `05-piagent.md` | `docs/protocols/piagent.md` |
| `06-evolution-loop.md` | `docs/protocols/agent-evolution.md` |
| `07-adoption-and-checks.md` | `CONTRIBUTING.md` + CI 文档 |
| `templates/` | 根四契约初始版本（变更 1） |
| `scripts/` | `scripts/meta/`（变更 1） |

## Risks / Trade-offs

- 风险：归并时丢失细节 → 逐节对照，先合并再删除；保留 zip 可回溯。
- 风险：链接断裂 → 归并后跑链接/引用检查，更新所有相对路径。
- 风险：Agent 仍读旧路径 → 根 `AGENTS.md` 与 `openspec/project.md` 同步更新。
- 权衡：删除提取目录会让 diff 很大，但这是消除双真源的必要代价。

## Migration Plan

1. 先建 `docs/ARCHITECTURE.md` 与 `docs/protocols/*.md`，逐节对照参考包。
2. 更新 `docs/META_LANGUAGE.md` 术语与不变量、文档真源表。
3. 更新 `AGENTS.md`、`openspec/project.md`、`CONTRIBUTING.md`。
4. 标记 `docs/reference/README.md` 为历史。
5. 删除已并入的参考包提取内容；保留 `reference.zip`。
6. 回退：从 zip 恢复参考包，撤销文档提交；不影响代码。

## Open Questions

- 是否保留 `docs/reference/templates/` 作为“可复制骨架”？
  - 默认不保留；根四契约已经是活文档，模板会再次形成第二来源。
- 是否把 `docs/ARCHITECTURE.md` 并入 `openspec/project.md`？
  - 不。项目上下文应短，架构细节应独立可读。
