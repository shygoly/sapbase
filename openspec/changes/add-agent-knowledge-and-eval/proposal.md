# Change: PiAgent 知识库与评测闸门（P3b）

> 执行顺序：**5 / 8**
> 依赖：变更 3（Release 闸门）、变更 4（Runtime Context Envelope）
> 参考：`docs/reference/05-piagent.md` §8/§11、`06-evolution-loop.md` §8、`07-adoption-and-checks.md` §P3

## Why

PiAgent 目前没有可审核、可回退的知识来源，也没有评测：
模型回答无法绑定 `knowledgeVersion`，发布 Agent 相关变更时没有 G5 证据。
如果把反馈原文或经验直接塞进提示词，就会形成“影子学习”——不可审核、不可回退、会扩散。

本变更把“学到的东西”变成**可发布制品**：`KnowledgeEntry` 只追加版本、发布后生效；
`EvalRun` 绑定 `releaseId + skillVersion`，作为发布闸门 G5 的证据。

## What Changes

- **ADDED** `agent_knowledge_entries`：知识条目，带 scope / version / status / releaseId
- **ADDED** `agent_skill_versions`：技能集版本（`draft → canary → active → retired`）
- **ADDED** `agent_eval_cases`：版本化评测用例
- **ADDED** `agent_eval_runs`：评测运行记录，绑定 `releaseId + skillVersion`
- **ADDED** 知识提议 → 审核 → 发布流程；发布前敏感信息检查（fail-closed）
- **ADDED** 知识检索：按 release/scope/权限过滤，只取已发布版本
- **ADDED** 评测套件：faq / navigate / query / write / refusal / injection / release
- **ADDED** G5 闸门：写越权 0、注入 100% 等硬门槛；不达标拒绝发布
- **ADDED** 回归阈值：相对上一版本下降 > 2% 拒绝发布
- **MODIFIED** PiAgent 回答：绑定并展示 `releaseId + skillVersion + knowledgeVersion`
- **MODIFIED** `ReleaseValidationService`：接入 G5 证据

**BREAKING**：无。知识检索默认关闭；评测先可 `warn`，稳定后转 `error`。

## Impact

- Affected specs: `agent-knowledge`、`agent-eval`（新增）
- Affected code:
  - `libs/agent-kernel`（检索过滤、引用格式）
  - `backend/src/agent-knowledge/**`、`backend/src/agent-eval/**`
  - `backend/src/releases/validation/**`（G5）
  - `backend/src/migrations/*CreateAgentKnowledge*`、`*CreateAgentEval*`
  - `shared-schemas`（KnowledgeEntry、EvalRun 类型）
  - `speckit` 知识管理页与发布详情评测报告
  - `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`

## Out of Scope

- 不做 Builder 自动起草知识（变更 7 可调用本变更的草稿 API）
- 不做 A2 自动发布（变更 8）
- 不引入外部向量数据库；v1 用 PG 全文/关键词检索
- 不把客户原文或个人数据存入知识条目
