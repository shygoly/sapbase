# 01 · 元模型与工程落点

> 本文把 `docs/META_LANGUAGE.md` 的元模型 `Ω` 翻译成 Nx 工程里的**具体落点**，
> 并给出本参考包新增的发布/智能体不变量。它不重新定义 `Ω`；冲突时以元语原文为准。

---

## 0. 什么叫“元语”

一个约定要成为元语，必须同时满足三条：

1. **可指认**：能指到 `Ω` 的某个维度，或指到某份契约的某个字段。
2. **可判定**：两个人对同一条约定能得出相同的“通过/不通过”。
3. **可执行**：有代码、Schema、测试、脚本或审计记录在强制它。

只满足“读起来有道理”的，是偏好，不是元语。偏好放在 `docs/style/`，
不要混进 `DOMAIN.md` / `FLOWS.md` / `DECISIONS.md`。

---

## 1. 四层：词、型、约、证

| 层 | 回答 | 载体 | 失效表现 |
|---|---|---|---|
| 词 | 这个东西叫什么 | 术语表（本文 §5） | 同义词泛滥、代码与文档对不上 |
| 型 | 它由哪些维度构成 | `Ω`（本文 §2） | 概念无法建模、只能靠提示词 |
| 约 | 它必须满足什么 | 四份契约（`03-contracts.md`） | 评审靠记忆、改动靠口头 |
| 证 | 怎么证明它成立 | 测试 / 审计 / 发布记录 / 评测 | 上线才发现、回退找不到依据 |

**单向依赖**：证依赖约，约依赖型，型依赖词。词变了要重审型；型变了要重写约；
约变了要重跑证。反过来不成立：不能因为测试好写就改词。

---

## 2. `Ω` 在 Nx 工程中的落点

`sapbase` 的元语原文把业务系统定义为：

```text
Ω = ⟨E, O, R, Φ, Σ, Λ, Γ, Τ, V, C⟩
```

本参考包不新增维度。新增的“发布”和“智能体”分别落在 `V`/`C` 与 `Γ`/`Φ` 上。

| 维度 | 含义 | Nx 工程落点 | 机器可校验的载体 |
|---|---|---|---|
| `E` Entity | 业务实体/字段/枚举 | `schemas/blueprint-semantic.schema.json`、`libs/shared-schemas` | JSON Schema + 编译期校验 |
| `O` Object | 实体实例 | PG 表 + `libs/domain-*` 类型 + `libs/infra-*` 仓储 | `DOMAIN.md` 覆盖矩阵 + 迁移 |
| `R` Relation | 实体关系 | PG 外键/关联表 + `DOMAIN.md` 关系表 | `check-domain-doc.mjs` |
| `Φ` Policy | 校验/审批/权限/行为 | `libs/domain-*/**/policy-*`、`rules.json`、Guard | 单测 + 策略测试 + 权限 all-of |
| `Σ` State | 状态机 | `libs/domain-*/**/state-machine.ts`、`flows.json` | 状态迁移表 + 单测 |
| `Λ` Event | 领域事件 | `libs/infra-events` + `backend/src/outbox/` | Outbox 表 + 幂等键 |
| `Γ` Capability | 能力/工具/模块 | `contracts/tools.json`、`module-registry`、`agent-tools` | `check-agent-tools.mjs` |
| `Τ` Time | 生命周期/生效时间 | `created_at` / `updated_at` / `effective_at` / `expires_at` | DDL 约定 + 审计 |
| `V` Version | 版本/迁移/发布 | `app_releases`、`releaseDigest`、`app_installation_revisions` | Release 状态机 + 摘要重算 |
| `C` Context | 租户/组织/应用/权限上下文 | `TenantAwareEntity`、`organization-context`、RLS、`appContext` | RLS 测试 + 上下文守卫 |

### 2.1 为什么“发布”不是新维度

发布是 `V`（版本）与 `C`（应用实例）的**组合快照**：

```text
Release = 某 appKey 在某一时刻的
          E + O + R + Φ + Σ + Λ + Γ + Τ + 元数据
          的不可变快照，带 digest 与签名。
```

`BusinessApp` 只是 `appKey` 级别的稳定标识；某个租户的运行实例仍是既有的
`BusinessAppInstallation`。两者都不是新维度。

Release 是 `V` 的一个具体取值，不是一个新字母。把发布做成新维度会导致
“发布里还能再发布”的递归，也让 Blueprint 的既有格式失去意义。

### 2.2 为什么“智能体”不是新维度

智能体是 `Γ`（它能调用的能力）与 `Φ`（平台允许它做什么）的组合：

```text
PiAgent = 一个受策略约束的能力调用者
        = Γ（工具/知识/模型） + Φ（权限/确认/预算/审计）
```

它不拥有事实（事实在 `O`），不拥有规则（规则在 `Φ`/`Σ`），不拥有发布权（发布在 `V`）。
这三条是 `docs/protocols/chat-erp.md` 已经写死的边界，本文沿用。

---

## 3. 不变量

命名空间与 `META_LANGUAGE.md` 一致：

- `INV-<AREA>-<NN>`：运行时必须成立的不变量，落在 `DOMAIN.md` 或本文。
- `D-<NN>`：架构决策，落在 `DECISIONS.md`。
- `TD-<NN>`：技术债，落在 `docs/tech-debt.md`。
- `FLOW-<AREA>-<NN>`：业务线，落在 `FLOWS.md`。
- `INV-REL-*` / `INV-AGENT-*`：本参考包新增的发布与智能体不变量。

> 本节是**跨领域不变量登记表**；具体到某张表/某个服务的 `INV-<AREA>-NN` 仍写在
> `DOMAIN.md` 的 `yaml invariant` 块里（见 `03-contracts.md` §2.4）。两者不重复：
> 本节管“所有领域都必须成立”，`DOMAIN.md` 管“这个领域具体怎么成立”。

### 3.1 元规则（INV-META）

| ID | 判据 | 强制点 |
|---|---|---|
| INV-META-01 | 一个概念只有一个中文名、一个英文名、一个代码标识符；新同义词必须进废弃表 | 术语表评审 + 代码检索 |
| INV-META-02 | 每个持久事实只有一处真源；其他文档只能引用，不能复述出第二版 | PR 评审 + 链接检查 |
| INV-META-03 | 契约变更必须同时更新对应 checker；checker 未更新视为契约未完成 | CI `check:*` |
| INV-META-04 | 每个一级目录有 `AGENTS.md` 或索引条目；Agent 按 `##` 切片读取，不整文件加载 | `AGENTS.md` + 目录检查 |
| INV-META-05 | 新增/修改能力先有 OpenSpec change 或本目录对应章节，再写实现 | PR 模板 + 评审 |

### 3.2 数据（INV-DATA）

| ID | 判据 | 强制点 |
|---|---|---|
| INV-DATA-01 | 每张业务表必须进 `DOMAIN.md` 覆盖矩阵；无归属的表不得上线 | `check-domain-doc.mjs` |
| INV-DATA-02 | 每条关系必须声明强制点：`db-fk` / `service:path#symbol` / `policy:path#symbol` / `ui` / `none`（附理由） | `check-domain-doc.mjs` |
| INV-DATA-03 | 同一状态机只有一套状态词；DB CHECK、枚举、字典三选一，不得三套并存 | `DOMAIN.md` + DDL |
| INV-DATA-04 | 金额用 `numeric(p,s)`，时间用 `timestamptz`；禁止浮点金额与本地时间 | DDL 评审 + lint |
| INV-DATA-05 | 所有业务表带 `organization_id`；RLS 是最后拒绝边界，不是唯一防线 | RLS 测试 + 迁移 |
| INV-DATA-06 | 破坏性迁移必须 expand/contract：先加后迁再删，不允许单步删列/改类型 | 迁移评审 + dry-run |
| INV-DATA-07 | 软删除只用 `deleted_at`；查询必须显式过滤，不得依赖“默认条件” | 仓储层测试 |

### 3.3 行为与时间（INV-FLOW）

| ID | 判据 | 强制点 |
|---|---|---|
| INV-FLOW-01 | cron 三向相等：`FLOWS.md` 调度总表 = registry `jobKey` = 代码装饰器 name | `check-meta-docs.mjs` |
| INV-FLOW-02 | 业务线 producer/consumer 无死边：每个产出都有消费者，每个消费都有产出 | `FLOWS.md` `dead_edge_check` |
| INV-FLOW-03 | 每个 job/事件消费者必须有幂等键；重复投递不产生重复副作用 | Outbox/作业测试 |
| INV-FLOW-04 | 失败必须可见：重试、死信、告警至少有一条路径，禁止静默吞异常 | 作业测试 + 日志 |

### 3.4 发布（INV-REL）

| ID | 判据 | 强制点 |
|---|---|---|
| INV-REL-01 | 已发布 Release 不可变；任何修复产生新版本 | DB 触发器/服务层 + 测试 |
| INV-REL-02 | `releaseDigest` 由平台重算，不信任客户端提交值 | 发布服务 + 测试 |
| INV-REL-03 | 激活是追加记录，不覆盖历史；回退也是追加一条新激活 | `app_release_activations` |
| INV-REL-04 | 同一 `appKey + organizationId` 同时只有一个 `active` Release；灰度 cohort 必须显式声明 | 唯一索引 + 服务校验 |
| INV-REL-05 | 每个 Release 必须绑定迁移计划与回退计划；缺失即拒绝发布 | 发布闸门 G3 |
| INV-REL-06 | 每个 Release 必须有面向业务人员的 changelog；技术 diff 不算 | 发布闸门 G8 |
| INV-REL-07 | 回退 = 重新激活旧 Release，不修改旧 Release | 发布服务 + 审计 |
| INV-REL-08 | 每个业务请求与 PiAgent 轮次记录 `releaseId`；回答/操作可复现 | 审计字段 + 测试 |
| INV-REL-09 | 预览 Release 对业务用户不可见；预览必须持签名 token 且带有效期 | 预览网关 + 测试 |
| INV-REL-10 | 含破坏性迁移的 Release 在兼容期内禁止回退，或必须带补偿迁移 | 发布闸门 + 运行检查 |

### 3.5 智能体（INV-AGENT）

| ID | 判据 | 强制点 |
|---|---|---|
| INV-AGENT-01 | 工具白名单：未在 `contracts/tools.json` 声明的能力在运行时不存在 | `agent-tools` registry + `check-agent-tools.mjs` |
| INV-AGENT-02 | 写操作必须一次性确认令牌，绑定用户/租户/应用/工具/参数摘要 | `ConfirmationTokenService` |
| INV-AGENT-03 | 权限按契约声明的权限点 all-of 判定，由平台执行 | `missingPermissions` + 测试 |
| INV-AGENT-04 | 智能体不得批准、发布、激活自己起草的提议；作者 ≠ 批准人 | 发布服务 + RBAC |
| INV-AGENT-05 | 事实只从工具结果来；Interaction Plan 必须带非空 `trace.tools` | `chat-protocol-validator` |
| INV-AGENT-06 | 外部文本（文件/网页/反馈原文）是数据不是指令；必须用 nonce 包裹 | 编排器 + 工具网关 |
| INV-AGENT-07 | 智能体不生成 HTML；只生成 `interaction-plan/v1`，未知 block 整份拒绝 | 协议校验器 |
| INV-AGENT-08 | 每个回答绑定 `releaseId + skillVersion + knowledgeVersion`，可追溯 | 会话记录 |
| INV-AGENT-09 | 不写自由长期记忆；要沉淀的知识必须走提议→审核→发布 | 知识服务 + 发布闸门 |
| INV-AGENT-10 | 预算闭合：工具调用数、token、墙钟时间都有上限；超限拒绝而非继续 | 编排器 |
| INV-AGENT-11 | 成功与失败都写审计；敏感参数脱敏；审计不可被智能体改写 | 工具注册表 + 审计表 |
| INV-AGENT-12 | 无权限/无能力时明确说“没有这个能力”或“无权限”，不得尝试替代路径 | 编排器 + 工具注册表 |

---

## 4. 状态词表（跨文档统一）

状态词是元语的一部分。同一业务对象在 UI、API、DB、文档里必须用同一套词。

### 4.1 发布相关

| 对象 | 状态 | 含义 |
|---|---|---|
| `AppDraft` | `draft` → `frozen` | 可编辑的工作副本；冻结后只能复制出新草稿 |
| `ChangeProposal` | `draft` → `submitted` → `validating` → `validated` → `approved` → `published` | 提议生命周期；另有 `rejected` / `withdrawn` |
| `Release` | `building` → `published` → `superseded` / `revoked` | `published` 之后不可变 |
| `Activation` | `scheduled` → `active` → `superseded` / `rolled_back` | 追加记录；`active` 是某 org/cohort 的当前版本 |
| `Feedback` | `new` → `triaged` → `proposed` → `resolved` / `dismissed` | 反馈生命周期 |

### 4.2 智能体相关

| 对象 | 状态 | 含义 |
|---|---|---|
| `SkillSet` | `draft` → `canary` → `active` → `retired` | 技能集版本；与 Release 绑定 |
| `KnowledgeEntry` | `draft` → `published` → `superseded` | 只追加版本；回退=重新发布旧版 |
| `EvalRun` | `running` → `passed` / `failed` / `error` | 发布闸门 G5 的证据 |

**禁止**：在代码里另造 `done` / `finished` / `completed` 等同义词表示同一状态。
新增状态必须先改本节，再改代码与 DDL。

---

## 5. 术语表

> 规则：中文名用于文档与 UI；English 用于设计讨论；代码标识符用于代码与 Schema。
> 三者一一对应。新增术语先在这里加行，再写代码。

| 中文 | English | 代码标识符 / 落点 | 状态 |
|---|---|---|---|
| 元语 | Meta Language | `docs/META_LANGUAGE.md` | ✅ |
| 元模型 | Meta Model | `Ω` | ✅ |
| 业务系统 | Business App | `appKey`、`app_installations` | ✅ |
| 应用安装 | App Installation | `BusinessAppInstallation` | ✅ |
| 草稿 | Draft | `AppDraft`、`app_drafts` | ⬜ |
| 变更提议 | Change Proposal | `ChangeProposal`、`app_change_proposals` | ⬜ |
| 发布 | Release | `Release`、`app_releases` | 🟡 |
| 发布摘要 | Release Digest | `releaseDigest` | ✅ |
| 激活 | Activation | `app_release_activations` | ⬜ |
| 灰度 | Canary | `cohort`、`percentage` | ⬜ |
| 回退 | Rollback | `rollback`、`app_installation_revisions` | 🟡 |
| 变更日志 | Changelog | `release_notes` | ⬜ |
| 影响面 | Impact Set | `ImpactSet` | ⬜ |
| 反馈 | Feedback | `agent_feedback` | ⬜ |
| 证据 | Evidence | `evidenceRefs[]` | ⬜ |
| 智能体 | Agent | `PiAgent` | 🟡 |
| 构建者智能体 | Builder Agent | `piagent-builder` | ⬜ |
| 运行智能体 | Runtime Agent | `piagent-runtime` | 🟡 |
| 能力 | Capability | `module-capability`、`CapabilityType` | ✅ |
| 工具契约 | Tool Contract | `contracts/tools.json` | ✅ |
| 确认令牌 | Confirmation Token | `agent_confirmation_tokens` | ✅ |
| 上下文包 | Context Envelope | `ContextEnvelope` | ⬜ |
| 技能集 | Skill Set | `SkillSet`、`skillVersion` | 🟡 |
| 知识条目 | Knowledge Entry | `KnowledgeEntry` | 🟡 |
| 评测 | Agent Eval | `EvalRun`、`agent_eval_runs` | ⬜ |
| 轨迹 | Trace | `traceId`、`agent_tool_calls` | 🟡 |
| 租户 | Organization | `organizationId` | ✅ |
| 应用上下文 | App Context | `BusinessAppExecutionContext` | ✅ |
| 不变量 | Invariant | `INV-*` | ✅ |
| 决策 | Decision | `D-*` | ✅ |
| 技术债 | Tech Debt | `TD-*` | ✅ |

### 5.1 废弃/禁用词

| 禁用 | 改用 | 原因 |
|---|---|---|
| 模块版本 / 系统版本 / 包版本（混用） | `Release`（业务发布） / `Blueprint version`（包版本） | 三个不同概念，不能都叫“版本” |
| 上线 / 部署 / 发布（混用） | `deploy`（进程） / `publish`（生成 Release） / `activate`（对租户生效） | 三个动作，回滚语义不同 |
| AI / 大模型 / 助手 / Bot（指同一物） | `PiAgent` 或具体 profile | 避免“助手”既指 UI 又指后端 |
| 知识 / 记忆 / 经验（混用） | `KnowledgeEntry`（已发布） / `ConversationMemory`（会话） | 只有前者可跨会话 |

---

## 6. 文档真源表

**新增内容先往这些文件里放，不要另建第四份“总设计”。**

| 主题 | 真源 | 说明 |
|---|---|---|
| 元模型、五协议、执行原语、总不变量 | `docs/META_LANGUAGE.md` | 定义层最高优先级 |
| 项目上下文、技术栈、硬约束 | `openspec/project.md` | AI 助手入口 |
| 变更提案与任务清单 | `openspec/changes/<change-id>/` | OpenSpec 流程 |
| 数据契约（表/列/关系/不变量） | `DOMAIN.md`（根目录，采用后） | 本目录 `templates/DOMAIN.template.md` |
| 行为/时间契约（cron/业务线） | `FLOWS.md`（根目录，采用后） | 本目录 `templates/FLOWS.template.md` |
| 架构决策 | `DECISIONS.md`（根目录，采用后） | 本目录 `templates/DECISIONS.template.md` |
| 智能体工具面 | `AGENT-TOOLS.md` + `contracts/tools.json` | 本目录 `templates/AGENT-TOOLS.template.md` |
| 发布/版本模型 | `docs/reference/04-versioning-release.md` | 采用后并入 `META_LANGUAGE.md` 或独立协议 |
| PiAgent 与进化闭环 | `docs/reference/05-piagent.md`、`06-evolution-loop.md` | 采用后拆成 `docs/protocols/piagent*.md` |
| 发布物格式 | `docs/protocols/blueprint-delivery.md`、`schemas/blueprint-*.json` | 不重复定义 |
| Chat/Interaction Plan | `docs/protocols/chat-erp.md` | 不重复定义 |
| 当前技术栈差距 | `docs/TECH_STACK_GAP.md` | 迁移依据 |
| 包管理器 | `docs/PACKAGE_MANAGER.md` | 采用 Nx 后更新 |

**入口分层**：

```text
AGENTS.md（仓库级：元语 + 5 条硬规则）
   ↓
docs/META_LANGUAGE.md（定义层）
openspec/project.md（上下文）
openspec/AGENTS.md（流程）
   ↓
文档真源表（本表）
   ↓
各子系统 AGENTS.md / README.md（作用域入口）
```

---

## 7. 变更流程

任何改动按这个顺序，不允许跳步：

```text
1. 在术语表找到落点
   ├─ 找不到 → 先扩展术语表（本文 §5），再继续
   └─ 找到 → 2
2. 判断改的是哪一层
   ├─ 词 → 改术语表 + 检索全仓同义词
   ├─ 型 → 改 Ω 落点 + Schema
   ├─ 约 → 改对应契约 + checker
   └─ 证 → 改测试/审计/评测
3. 立 OpenSpec change（新能力/破坏性变更）
4. 改契约 → 改实现 → 跑 check:* + 测试
5. 更新 DOMAIN/FLOWS/DECISIONS/AGENT-TOOLS 对应条目
6. PR 评审：评审者按 §3 不变量逐条勾
```

**热修复例外**：生产事故可以先修代码，但必须在 24 小时内补契约与回归测试；
补不上的，登记 `TD-x` 并写清偿还日期。

---

## 8. 反模式

| 反模式 | 为什么错 | 正确做法 |
|---|---|---|
| 在 PR 描述里写“约定：xxx”，但不进任何契约 | 下一个人看不到，Agent 也读不到 | 进术语表或对应契约 |
| 同一个状态在 DB 是 `completed`、API 是 `done`、UI 是“已完成” | 三套词必然漂移 | 一套状态词 + 映射层 |
| 用提示词约束 Agent“不要越权” | 提示词是请求，不是边界 | 平台权限 + 工具白名单 + 确认令牌 |
| 把已发布 Release 当草稿改 | 无法复现、无法回退 | 复制出新草稿，发布新版本 |
| 发布=上传包 | 没有激活、没有灰度、没有回退 | 走 Release/Activation 状态机 |
| 让 Agent 自己批准自己的提议 | 利益冲突，审计失效 | 作者 ≠ 批准人；平台校验 |
| 把“知识”写进 Agent 的长期记忆 | 无法审核、无法回退、会扩散 | `KnowledgeEntry` + 发布流程 |
| 用 `db pull` / 手改生产库同步 Schema | 丢注释、丢索引、不可复现 | Schema 真源 + 迁移文件 |
