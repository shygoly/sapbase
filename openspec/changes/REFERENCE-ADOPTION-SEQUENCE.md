# 参考包采用顺序（/goal 执行索引）

> 本文件只是执行索引，不是 OpenSpec change，不参与 `openspec list`。
> 按顺序执行；每一步完成并通过验收后再进入下一步。

| # | Change ID | 阶段 | 依赖 | 交付重点 |
|---|---|---|---|---|
| 1 | `add-meta-contracts-and-checkers` | P0 | 无 | 四契约 + schema manifest + checker + CI warn-only |
| 2 | `adopt-nx-workspace-and-boundaries` | P1 | #1 | Nx project graph + tags + 边界 warn + `libs/shared-core` |
| 3 | `add-release-lifecycle-and-activation` | P2 | #2 | 不可变 Release + activation + 回退 + changelog |
| 4 | `add-piagent-runtime-context-and-session` | P3a | #3 | Context Envelope + 多轮 + SSE + 预算 |
| 5 | `add-agent-knowledge-and-eval` | P3b | #3、#4 | KnowledgeEntry + SkillSet + Eval + G5 |
| 6 | `add-builder-governance-loop` | P4 | #3–#5 | 反馈 → 议题 → 提议 → 审批（A1） |
| 7 | `add-a2-release-automation` | P5 | #3–#6 | A2 白名单 + 灰度 + 护栏 + 自动回退 |
| 8 | `merge-reference-docs-into-truth-sources` | P5 | #1–#7 | 合并参考包，消除双真源 |

## 执行建议

- 每个 change 先用 `openspec validate <change-id> --strict`（若本机已安装 CLI）。
- 每个 change 实现后跑对应验收命令；不要跳过依赖顺序。
- 不要在一个 change 中顺手做下一个 change 的结构性变更。
- 变更 8 会删除 `docs/reference/` 中已并入的提取文本；`docs/reference.zip` 保留作历史归档。

## weichen 基线重新审查入口（2026-11-10，仅新增提案）

新增批次见 [weichen AI Native 整改执行索引](./AI-NATIVE-REMEDIATION-SEQUENCE.md)，准确基线为 `ce1e538dcec6539f66bba80d5413a3b6741486c9`，分支 `docs/weichen-ai-native-remediation-20261110`。该索引列出11个新change、直接依赖/并行区、唯一producer/consumer、已解决项退出及真实后置验收。main旧规划仅对照，不代表weichen实测；上方历史顺序及状态未修改。

本批全部是pending proposals/tasks，未apply/archive、未实施迁移部署或操作生产开关。格式校验/台账生成不表示生产通过；冻结候选先完成真实G0–G6，再可信批准、签名未公开工件、最终GateDecision、published，最后独立activation。真实模型/数据库/构建/browser及A1端到端未验收前不得由文档或旧任务勾选放行有限A2。
