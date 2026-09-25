# 已废弃：Refactor AI Module to DDD

**状态**：废弃（未实施，0% 完成）
**关闭日期**：2026-09-24
**关闭原因**：

1. 任务 0/77，自 2026-02-18 起无进展；
2. `openspec validate --strict` **不通过** —— 该变更没有 `specs/` 目录，
   因此没有任何 delta（`Change must have at least one delta`），不符合 OpenSpec 的变更格式；
3. 无 delta 意味着它从未定义"完成后系统应该是什么行为"，也就无法验收。

## 为什么会走到这一步

这批 DDD 重构（ai-module / auth / organization）是 AI 批量生成的变更，
只产出了 `proposal.md` + `design.md` + `tasks.md`，缺少 `specs/<capability>/spec.md`。
OpenSpec 的流程里 specs 才是"行为契约"，tasks 只是实施清单 ——
没有前者，后者就无法被判定完成与否。

同批的 `refactor-workflow-to-ddd` 写了 specs 且推进到 60/79，因此**不在废弃之列**。

## 如果将来要重启

不要直接搬回 `changes/`（目录结构和内容都已过时）。正确做法是**重新立项**：

1. 先读 `docs/META_LANGUAGE.md` 与 `openspec/project.md` 对齐术语与约束；
2. 按当前代码实际状态重写 `proposal.md`（原提案写于 2 月，之后 workflow/plugin/saas 等已大幅变化）；
3. **必须**写 `specs/<capability>/spec.md` 的 delta（`## ADDED|MODIFIED Requirements` + 每个需求至少一个 `#### Scenario:`）；
4. `openspec validate <change-id> --strict` 通过后再动手。

本目录保留作为历史记录，不参与 `openspec list`。
