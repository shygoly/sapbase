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
