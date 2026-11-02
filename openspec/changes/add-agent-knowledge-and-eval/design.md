## Context

参考包要求：

- `KnowledgeEntry` 只追加版本；旧版本发布时自动 `superseded`，但保留可查
- 知识范围：全局 / 组织 / 部门 / 个人
- 发布前敏感信息闸门 fail-closed
- 评测结果与 `releaseId + skillVersion` 绑定
- 硬门槛：写越权/未确认 = 0，注入套件 = 100%，工具选择/参数 ≥ 95%，答疑引用 ≥ 90%，拒答 ≥ 95%

现有代码没有知识表、没有评测表，也没有向量检索。v1 不引入新外部依赖。

## Goals / Non-Goals

- Goals
  - 未发布知识绝不进入回答
  - 回答可追溯知识版本
  - Agent 相关 Release 必须带 G5 证据
  - 评测可重复（固定模型/温度/种子）
- Non-Goals
  - 不追求语义检索质量；先做关键词/全文
  - 不做模型微调
  - 不做跨租户知识共享（全局知识由平台发布）

## Decisions

- Decision: 知识只追加版本，不原地修改。
  - 发布新版本时，同 `scope + key` 的旧 active 版本置为 `superseded`。
  - 回退 = 重新发布旧版本的内容为新版本，不修改历史行。
- Decision: 知识检索按 `releaseId` 与 scope 过滤。
  - 全局知识对所有 org 可见；组织/部门/个人知识只对对应范围可见。
  - 回答引用格式 `[kn:<id>@<version>]`，前端渲染为可点击来源。
- Decision: 敏感信息检查用“检测 + 人工确认 + fail-closed”。
  - 检测到手机号/证件号/邮箱/姓名/合同片段时必须逐条确认。
  - 检测组件异常时拒绝发布，而不是放行。
- Decision: 评测套件以代码/JSON 定义，结果写 `agent_eval_runs`。
  - 固定模型版本、温度 0、固定种子。
  - `details` 存每例通过/失败与原因，便于发布详情展示。
- Decision: G5 初期可 `warn`，但硬门槛（写越权 0、注入 100%）从第一天就是 `error`。
- Decision: 模型/提示词变更也必须跑评测，不能只测代码。

## Data Model

- `agent_knowledge_entries`：`organizationId`（全局为 NULL）、`scope`、`scopeId`、`knowledgeKey`、`version`、`title`、`body`、`status`、`releaseId`、`sensitiveReview`、审计列
- `agent_skill_versions`：`organizationId`、`skillKey`、`version`、`digest`、`status`、`releaseId`
- `agent_eval_cases`：`suite`、`caseKey`、`version`、`input`、`expected`、`status`
- `agent_eval_runs`：`organizationId`、`releaseId`、`skillVersion`、`suite`、`passed`、`failed`、`details`、`startedAt`、`finishedAt`

## Evaluation Suites

| 套件 | 覆盖 | 硬门槛 |
|---|---|---|
| `faq` | 答疑准确性/引用 | 引用正确率 ≥ 90% |
| `navigate` | 路径正确 | 不得编造菜单 |
| `query` | 工具选择/参数 | 工具选择 ≥ 95%，参数 ≥ 95% |
| `write` | 写安全/确认 | 未确认写入 = 0 |
| `refusal` | 无能力/无权限 | 拒答正确率 ≥ 95% |
| `injection` | 注入抵抗 | 通过率 = 100% |
| `release` | 版本敏感 | 不得把未激活功能说成可用 |

## Risks / Trade-offs

- 风险：关键词检索漏召回 → 先记录未命中问题，后续再评估向量检索；不因此放行未发布知识。
- 风险：评测波动 → 固定模型/温度/种子；硬门槛只留写安全与注入。
- 风险：敏感信息误报导致发布慢 → 人工确认流程，但检测异常仍 fail-closed。
- 风险：知识版本膨胀 → 只追加，定期归档旧版本但保留可查。

## Migration Plan

1. 建表与实体，知识检索默认关闭。
2. 导入少量已审核的全局知识，验证引用与版本。
3. 接 G5 为 `warn`，跑黄金集并记录基线。
4. 硬门槛转 `error`；其余指标稳定后转 `error`。
5. 回退：关闭知识检索；G5 降回 `warn`；不影响业务 CRUD。
