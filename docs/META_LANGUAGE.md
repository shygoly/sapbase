# 项目元语（Meta Language）

> 版本：1.14
> 日期：2026-10-18
> 定位：本文件是 sapbase 的**基础定义层** —— 元模型、协议原语、执行原语、工程约定与术语真源。
> 与设计文档的分工：设计文档回答"**要做什么**"，本文件回答"**用什么词、按什么不变量做、真源在哪**"。
> 任何新增设计、代码或文档，都应先在本文件的词汇与不变量里找到落点；找不到，说明元语需要扩展（走变更记录）。

---

## 0. 怎么用这份文件

| 角色 | 用法 |
| --- | --- |
| 写代码的人 | 命名与结构以第 6 节术语表的"代码标识符"为准，不要另造同义词 |
| 写设计/提案的人 | 引用第 1–3 节的原语，不要重新定义；新概念先扩展第 6 节 |
| 评审者 | 用第 4 节的不变量作为验收清单 |
| AI 助手 | 本文件 + `openspec/project.md` 是进入项目时必读的元上下文 |

---

## 1. 元模型：Ω

业务系统的第一性定义。**四个必需维度 + 六个渐进维度**，是所有语义对象的共同骨架：

$$
\Omega=\langle E,O,R,\Phi,\Sigma,\Lambda,\Gamma,\Tau,V,C\rangle
$$

| 符号 | 含义 | 必需性 | 仓库落点 |
| --- | --- | --- | --- |
| $E$ | Entity 业务实体 | 必需 | `libs/app-shared/src/core/schema/types.ts` 的 `ObjectSchema` |
| $O$ | Object 实体实例 | 必需 | 后端实体（`apps/api/src/**/*.entity.ts`） |
| $R$ | Relation 对象关系 | 必需 | `ObjectSchema.relations` |
| $\Phi$ | Constraint / Policy / Behavior | 必需 | `FieldDefinition.validation`、`apps/api/src/permissions`、规则（待统一） |
| $\Sigma$ | State 状态机 | 渐进 | 蓝图 `flows.json` + `semantic-runtime` 记录迁移；旧 `workflow_*` 四表只读归档（见 [`protocols/workflow-consolidation.md`](./protocols/workflow-consolidation.md)） |
| $\Lambda$ | Event 领域事件 | 渐进 | 跨进程：outbox（见 [`protocols/outbox.md`](./protocols/outbox.md)）；进程内：`apps/api/src/common/events/` |
| $\Gamma$ | Capability 能力 | 渐进 | `apps/api/src/module-registry/module-capability.entity.ts`、原子契约（提案中） |
| $\Tau$ | Time 生效时间与生命周期 | 渐进 | 各实体的 `createdAt/updatedAt`；生命周期语义待补 |
| $V$ | Version 版本与迁移 | 渐进 | `ObjectSchema.version`、`apps/api/src/migrations/` |
| $C$ | Context 租户/组织/应用实例/权限上下文 | 渐进 | `TenantAwareEntity` + `BusinessAppExecutionContext`；应用安装见 `app_installations` |

判据：**元模型是类型系统，不是提示词。** 任何"约定"必须能落到上表的某个维度或第 2、3 节的原语上，否则它不是元语，只是偏好。

---

## 2. 协议原语（五个核心协议）

这五个协议是平台的地基。**未冻结的协议不做实现**（见不变量 10）。

| # | 协议 | 目的 | 状态 | 落点 |
| --- | --- | --- | --- | --- |
| 1 | ERP Meta Model | 业务对象、字段、关系、状态、事件、能力、上下文、版本 | 🟡 部分 | 前端 Schema + `shared-schemas`；JSON Schema 权威源待建 |
| 2 | Atomic Contract | 原子能力的输入输出、前后置条件、副作用、幂等、权限、错误、实现封装 | ✅ 已冻结 | `schemas/atomic-contract.schema.json`、`schemas/atomic-module-manifest.schema.json`；实现见 `openspec/specs/atomic-registry/` |
| 3 | Blueprint Package | 完整 ERP 的语义/流程/规则/经验策略/授权/分层/签名；语义层落点含**主从结构 / 唯一性 / 金额精度** | 🟡 包 / IR / 规则 / 经验策略 / 授权已冻结 | `schemas/blueprint-{package,ir,rules,experience,license}.schema.json`；文本语法见 [`protocols/blueprint-ir.md`](./protocols/blueprint-ir.md)；交付与验签见 [`protocols/blueprint-delivery.md`](./protocols/blueprint-delivery.md)。主从 / 唯一 / 金额见 §3.8.1。BOM 属 semantic、Form 不做层。未覆盖文件仍拒 |
| 4 | Runtime SDK Contract | Blueprint 如何被本地 Runtime 加载、验证、编译、执行 | 🟡 加载链已实现 | 编译与加载见 3.8；执行链见 3.2、3.3。**待固化**：customer 本地 Runtime 侧的装载契约（runtime 范围协商、远端注册表） |
| 5 | License / Encryption Protocol | 模块如何加密、授权、绑定客户、防二次销售 | 🟡 蓝图授权声明与 Ed25519 验签已落地 | `schemas/blueprint-license.schema.json`、`apps/api/src/blueprint/license.ts`；加密与模块级许可仍待（v3 §11） |

---

## 3. 执行原语

### 3.1 Atomic Contract

**原子**是 ERP 的最小业务能力；**契约**描述它的接口与约束，与实现解耦。

- 类型：`calculation` / `query`（v1 允许）；`command` / `effect`（涉及事务与补偿，另立变更）
- 契约要素：`atomicType`、`version`、`inputSchema`、`outputSchema`、`permissions`、`errors`、`idempotency`
- 实现可换：同一契约可有 TypeScript 实现（平台自研，跑在内核）与 Wasm 实现（可交付，跑在沙箱）

### 3.2 Atomic Module 与 ABI v1

Wasm 原子模块的运行约定（已实现，见 [`wasm-modules/README.md`](../wasm-modules/README.md)）：

```text
run(in_off: i32, n: i32, out_off: i32) -> i32      // 0 = 成功
输入 @in_off : [on_hand: i32[n]] [reserved: i32[n]] [in_transit: i32[n]]
输出 @out_off: [available: i32[n]] [total_available: i32]
```

- 导出：`run`（函数）+ `abi_version`（函数或常量全局）+ 工具链全局 `__heap_base` / `__data_end`
- 导入：**恰好一个** `env.memory`，必须有上限
- 模块**不接收标识**（物料号、单据号、租户 ID），宿主只写整数列投影，调用后按下标回填
- **执行引擎**：Rust sidecar（`crates/wasm-host`，Wasmtime 48）提供 fuel 指令预算、epoch 中断与进程外隔离；
  V8 实现保留为对拍引擎与显式回退路径（`ATOMIC_ENGINE=v8`；回退需 `ATOMIC_ENGINE_FALLBACK` 且审计留痕）

### 3.3 准入闸（0–5）

| 闸 | 位置 | 挡什么 | 状态 |
| --- | --- | --- | --- |
| 0 源码预检 | 编译**之前** | `build.rs` / proc-macro / `.cargo/config` / 非空依赖 / npm 生命周期 | ✅ |
| 1 静态白名单 | 不运行就挡 | 非白名单导入、start 段、共享内存、GC、表、自定义内存、memory64、未授权导出 | ✅ |
| 2 复现构建 | 两个独立构建器 | 哈希不一致、"只交 `.wasm`"、夹带预构建 `target/` | ✅ |
| 3 输出管控 | 运行期（宿主侧） | 通过输出通道夹带数据、输出随行序变化、值越界 | ✅ 判据见 [`protocols/atomic-output-audit.md`](./protocols/atomic-output-audit.md)，实现在 `apps/api/src/atomic-runtime/output-gate.ts` |
| 4 影子发布 | 发布流程（宿主侧） | 未经影子验证直接上生产、凭一次请求跳级 | ✅ 证据门见 `apps/api/src/atomic-registry/shadow-release.ts`（补录必须带理由与决定人） |
| 5 吊销 | 执行前 | 已吊销模块继续执行、旧名单回放 | ✅（判定逻辑） |

附：准入层级 **Tier A**（平台自研）/ **Tier B**（第三方交源码、平台复现构建 + 审查），**不设 Tier C** —— 不透明二进制结构性地无法入册。

### 3.4 分层可见性

| 层 | 客户可见 | 可改 | 可导出 |
| --- | --- | --- | --- |
| Public（语义、表单、基础流程） | 是 | 是 | 是 |
| Config（阈值、字段映射、参数） | 是 | 是 | 部分 |
| Protected（核心规则、专有算法、特殊原子组合） | 否 | 否 | 否 |
| Kernel（Native/Wasm 执行内核） | 否 | 否 | 否 |

### 3.5 Capsule

- **Blueprint Capsule**：加密容器 + 授权边界的模板（可见层明文，Protected 层加密）
- **Capability Capsule**：进一步与 License、Key、Runtime、设备/租户绑定
- 核心等式：`模板文件 ≠ 可运行模板`；`文件 + License + Key + Runtime + 绑定 = 可运行`

### 3.5.1 插件沙箱（与原子同一套能力模型）

插件与本文件 §3.1–3.3 的原子**共用一套模型**，不是两套：

| 维度 | 原子 | 插件 |
| --- | --- | --- |
| 边界 | 零能力 Wasm（无导入、无 IO） | 受限子进程（`node --permission`：fs / 子进程 / worker 被关） |
| 声明 | `atomic-contract.schema.json` | `plugin-manifest.schema.json`（声明是能力的**唯一来源**） |
| 判定 | 契约声明权限点 all-of | 清单声明 → 权限点 → **同一份** `missingPermissions` |
| 失败 | fail-closed，不回退 | 同左（探测不到权限模型即拒，不退回同进程 `require`） |
| 审计 | `atomic.invoke` | `plugin.invoke` / `plugin.capability.denied` |
| 静态检查 | 闸 0/1/2 是判决（结构事实） | 源码文本扫描只是**信号**（可绕、会误报 → 无阻断权） |

判据文本：[`protocols/plugin-sandbox.md`](./protocols/plugin-sandbox.md)。
**已知边界（写在明面上）**：Node 的权限模型不覆盖出网 —— 平台能保证 fs/子进程/worker
三条路被关死，网络需要部署层策略；在此之前只建议允许 Tier A 插件。

### 3.6 增量协议（Delta）

LLM 的输出语言，是结构化增量而非自由文本。**它修改的对象是第 1 节元模型所描述的语义对象集合**，
并且是设计时产物写入该集合的唯一合法方式：

```json
{ "protocol": "space-delta/v1", "base_version": "rev-123",
  "operations": [ { "op": "add", "path": "/semantic/entities/-", "value": {} },
                  { "op": "link", "from": "...", "to": "...", "type": "belongsTo" } ] }
```

仓库既有 **Patch DSL**（`libs/app-shared/src/core/patch/`：5 类 scope、5 种操作、L1–L3 安全级）是它的前身，
演进路径为 `space-delta/v2`（扩展命名空间 + `link`/`unlink`），**不另起一套**。

### 3.7 Context Compiler 与决策分层

```text
L0 确定性层   平台预定义：Schema、路由表、预算策略、权限策略
L1 轻量模型层 意图分类、实体链接、候选排序、歧义消解
L2 大模型层   任务规划、复杂意图解析、Delta 修复
L3 验证层     Schema 验证、引用完整性、权限验证、可执行性验证
```

`Context Envelope` 由 Context Compiler 产出，是送给 LLM 的最小上下文包。

### 3.8 Blueprint 编译与加载链（v1）

从"作者的一堆文件"到"可执行计划"，七道关，**任一不过即拒**（无部分加载、无静默降级）：

```text
作者目录 ──packBlueprint──▶ .erpkg（包清单是包内唯一权威：逐文件 sha256 + 分层 + 依赖 + 签名）
.erpkg ──unpackBlueprint──▶ 内存结构（**永不落盘**：zip slip 最强的防线是没有写入机会）
.erpkg ──compileBlueprint─▶ IR（逐文件 Schema → 依赖闭包 → 冲突检测 → IR 自检）
.erpkg ──loadBlueprint────▶ 可执行计划
  1 完整性 → 2 编译 → 3 防漂移 → 4 license 形状 → 5 验签 → 6 授权匹配 → 7 绑定原子
```

| 环节 | 落点 | 关键约定 |
| --- | --- | --- |
| 打包 / 解包 | `apps/api/src/blueprint/packager.ts` | 清单由**打包器生成**（不手写）；`.erpkg` 只读进内存 |
| 编译 | `apps/api/src/blueprint/compiler.ts` | 未覆盖的文件**拒绝**；规则/经验策略引用必须可解析；IR 摘要覆盖新两层 |
| 加载 | `apps/api/src/blueprint/loader.ts` | 记录 `irDigest` 是**外部可写数据**，只用来与本次重编结果比对；授权门在装载器里 |
| 验签 | `apps/api/src/blueprint/license.ts` | Ed25519；权威签名在 `manifest.signature`；未配置公钥即失败 |
| 绑定 | `loader.resolveBindings` | 加载期就把 `moduleSha256` 定下来（"客户同意跑的那一份代码"），不留到第一次调用 |
| 导出 | `apps/api/src/module-registry/blueprint-export.ts` | 模块记录 → 最小蓝图：只声明模块**确实拥有**的实体名与原子依赖，字段与生命周期**不编** |
| 经验策略 | `experience.json` | **Experience Policy**：交互的决策输入，与 Interaction Surface（输出）配对 |

两条容易被忽略的边界，写在协议里而不是实现者的默契里：

1. **v1 的 flow 是 DAG**。步骤图成环即冲突；需要回环的场景用"事件再次触发流程"表达。
   反过来，**实体关系图的环不判**——`Employee.manager` 自引用与 `Order.billingCustomer` 回指都是合法建模。
2. **IR 双形态等价**。结构化 IR 与文本 IR 互相导出等价，且文本→结构→文本**逐字节一致**，可作 diff 基线
   （摘要 `compiled.irDigest` 就是文本形态的 sha256）。

### 3.8.1 语义层三条落点（主从 / 唯一性 / 金额精度）

这三条不是新协议，是协议 3 语义层已经能判定、并且已经落到运行时的结构事实：

| 落点 | 声明 | 运行时 | 真源 |
| --- | --- | --- | --- |
| **主从结构** | 头实体 `children` + 行实体 `parent`（编译期双向一致） | 头 + 行一次提交，一件事务，失败全不落 | [`schemas/blueprint-semantic.schema.json`](../schemas/blueprint-semantic.schema.json)、[`protocols/blueprint-delivery.md`](./protocols/blueprint-delivery.md) §7 / §12 |
| **唯一性** | 字段 `unique: true` | **落到 DB 唯一索引**，键含 `blueprintId` + `organizationId`（按蓝图 / 按租户隔离） | 同上 schema；实现 `apps/api/src/semantic-runtime/unique-index.ts` |
| **金额精度** | `decimal(p,s)` + `rounding`（`half-up` / `half-even`）；`money: true` 只能标在 decimal 上 | 定点整数小单位；**单一舍入点**（`roundTo`）；i32 小单位进原子；**禁止浮点** | 同上 schema；实现 [`apps/api/src/blueprint/money.ts`](../apps/api/src/blueprint/money.ts) |

### 3.9 Interaction Surface（临时交互面）

它不是页面、也不是表单，而是**一次意图的可视化投影**。确认或取消后即消失，不进入任何导航结构。

判据：任何"需要被记住位置、能被收藏、能通过 URL 直接到达"的东西**不是** Interaction Surface。

真源：[`protocols/chat-erp.md`](./protocols/chat-erp.md)。

### 3.10 Business App Installation（业务应用安装）

`BusinessAppInstallation` 是**租户内的应用运行边界**，不是新的业务定义格式，也不是 Ω 的新维度：

```text
Organization（客户）
  └─ AppInstallation（ERP / CRM / HRO / MES 的一个运行实例）
       ├─ signed Blueprint release + releaseDigest
       ├─ deployment profile（shared-saas / dedicated-saas / standalone）
       ├─ tenant config / lifecycle / license binding
       └─ App tool + menu + Agent context
```

- 可分发、可签名、可授权的业务定义仍是 **Blueprint**；AppInstallation 只绑定某个具体发布。
- 同一组织内 `appKey` 与 `slug` 各自唯一；换发布会走升级/回滚，不在安装接口里静默覆盖。
- 安装、升级、回滚都追加 `app_installation_revisions`，不重写历史；回滚必须重新装载目标发布并核对 release digest。
- 应用私有数据不得被同组织另一个应用直接读取；跨应用读取只能经过显式发布的数据能力。
- 客户端可以指明目标应用，但组织、用户、权限和应用状态必须由平台按可信身份重新解析。
- HTTP 租户请求在事务内写入 `app.organization_id/app.app_installation_id/app.user_id`；
  PostgreSQL RLS 是最后拒绝边界，且生产应用角色不得拥有绕过 RLS 的数据库权限。

真源：[`schemas/business-app-installation.schema.json`](../schemas/business-app-installation.schema.json)。

### 3.11 Data Scope（数据范围）

数据范围是**平台原语**，不是某个垂直行业的部门树：

- **范围域** `scope_dimensions`：可配置的树维度（region/campus/class…），行业词只是配置值。
- **范围节点** `scope_nodes`：物化路径 `parentId/path/depth`，任意深度。
- **范围成员** `scope_memberships`：主体（user/role/group）→ 节点 + 岗位 + 有效期。
- **资源绑定** `scope_bindings`：资源 → 维度 → 字段/归属/关系。
- **数据策略** `data_policies`：主体 + 资源 + 动作 + allow/deny + scope。
- **范围版本** `scope_versions`：组织级递增版本，缓存按它失效。

执行语义：

```text
最终可见 = 租户隔离 ∩ 功能权限 ∩ 数据范围
范围只收窄，不授予功能权限
蓝图模板 cap ∩ 租户策略；租户不能放大
未声明 dataScope → 旧行为（租户隔离）
声明 dataScope 但解析失败 → none（fail-closed）
```

实现落点：`libs/platform-core/src/data-scope/`（`ScopeEvaluator` / `ScopeSqlCompiler` /
`DataScopeService`），语义运行时列表/详情/写/删/迁移/导入已接入；内置视图/追溯与
Agent 工具面按消费方逐步接入。

### 3.12 Async Job & Callback（异步任务与回调）

异步任务是**可查询、可取消、可重试的命令**，不是事件（outbox）也不是 cron：

- **Job Type**：启动时注册的白名单（payload schema + handler + timeout/retry/concurrency）。
- **Job**：`jobs` 行，状态 `queued/running/waiting/succeeded/failed/cancelled/dead`。
- **Job Attempt**：每次领取一条，记录 started/finished/error/duration。
- **Job Event**：`progress/stage/log/callback/error`，`seq` 单调递增，可 `afterSeq` 回放。
- **Job Queue / Worker**：PG 真源 + `FOR UPDATE SKIP LOCKED` 领取；Redis 只做唤醒，poll 兜底。
- **Callback**：外部 URL + HMAC-SHA256 签名；2xx 成功，408/429/5xx 重试，其他 4xx 永久失败。

执行语义：

```text
入队与业务写入同事务；回滚不留任务
唯一键 (organizationId, type, idempotencyKey) → 重复入队返回同一任务
至少一次执行 + handler 幂等；exactly-once 不在 v1 承诺内
未知类型/非法 payload 拒绝入队；payload 不执行任意代码
回调 URL 默认 https + 禁私网/重定向；失败不改任务业务结果
Agent run 状态归 Agent Runtime；job 只携带 agentRunId 并桥接事件
```

实现落点：`libs/platform-core/src/jobs/`；契约：`schemas/async-job.schema.json`；
领域表：`DOMAIN.md`「异步任务」；决策：`DECISIONS.md` D-7/D-8/D-9。

### 3.13 Identity Federation & Sessions（身份联邦与会话）

身份与会话是平台边界，不是某个行业的账号表：

- **身份提供方** `identity_providers`：按组织配置 CAS/OAuth2/OIDC/SAML，secret 走 secretRef。
- **身份映射** `identity_links`：外部 subject ↔ 平台用户；JIT 建号只给默认角色。
- **多角色绑定** `organization_member_roles`：组织 + 用户 + 角色 + 来源 + 有效期。
- **持久会话** `auth_sessions`：JWT 携带 `sid`；吊销/过期以本表为准。
- **登录事件** `auth_login_events`：成功/失败/ip/ua/provider，用于异常登录。
- **同步批次** `identity_sync_runs`：生命周期同步的差异与失败记录。
- **服务客户端** `service_clients`：客户端凭证、scope、过期/吊销/白名单；secret 只存哈希。

执行语义：

```text
有效权限 = 本组织 active 角色并集 ∪ 直授；users.roleId 仅作回退
JWT 带 sid → 守卫校验会话；吊销后立即 401
SSO 失败/同步源不可用 → fail-closed，不降级到“信任调用方”
服务令牌代用户调用 → 服务端重新解析权限与数据范围
外部 subject 只用于映射，不直接作为平台 userId
```

实现落点：`libs/platform-core/src/identity/`；契约：`schemas/identity.schema.json`；
领域表：`DOMAIN.md`「身份与会话」；决策：`DECISIONS.md` D-10。

### 3.14 Notification Center & Announcements（通知与公告）

站内通知是**持久消息**，不是事件（outbox）也不是任务（async-job）：

- **Notification**：`notifications` 行；分类/优先级/动作链接/过期/已读时间/强制标记。
- **Preference**：`notification_preferences` 按组织 + 用户 + 分类存渠道开关/免打扰。
- **Announcement**：`announcements` 草稿 → `scheduled`/`published` → `withdrawn` → `expired`；
  audience 存 `announcement_audiences`（role/user/scope_node/scope_subtree）。
- **Delivery**：`announcement_deliveries` 逐用户投递/已读，唯一键 `(announcementId,userId)`。
- **Retention**：通知默认 30 天；公告按 `retentionDays`；到期只写 `deletedAt`，
  清理运行写 `notification_cleanup_runs`。

执行语义：

```text
站内持久化不受偏好影响；偏好只决定 WS/额外投递；mandatory 绕过 mute
audience 只从服务端成员/角色/数据范围解析，跨租户节点拒绝，解析失败按空集合
重复发布按 (announcementId,userId) 幂等，不产生第二条通知
超过阈值的大组织扇出走 notification.announcement_fanout 任务（进度/取消/重试）
正文只渲染安全 Markdown 子集；不执行原始 HTML，链接只允许 http/https
过期/撤回公告只软删除，统计与审计引用保留
```

实现落点：`apps/api/src/notifications/`；契约：`schemas/notification-center.schema.json`；
领域表：`DOMAIN.md`「通知与公告」；决策：`DECISIONS.md` D-11/D-12。

### 3.15 Search & Retrieval（搜索与检索）

搜索是**可重建的读模型**，不是业务真源：

- **SearchDocument**：`search_documents`，按组织 + 资源键 + 资源 ID 唯一；
  只存标题/正文/标签/元数据等可展示字段。
- **索引**：PostgreSQL `tsvector` 全文 + `pg_trgm` 兜底；GIN 索引，不引入外部搜索集群。
- **管道**：资源事件 → `search.index` 任务；全量重建 → `search.reindex` 任务。
  写入按 `contentHash` 幂等，索引失败不阻塞业务事务。
- **查询**：`GET /search` 支持关键词/类型/标签/时间/分页；结果带 `[[[`/`]]]` 高亮片段。
- **权限**：只查同组织文档；敏感字段不进入索引；跨租户返回空或拒绝。

执行语义：

```text
索引是派生物，可删除重建；业务表仍是唯一真源
同组织 + 资源键 + 资源 ID 唯一；内容 hash 未变不重写
索引写入失败不回滚业务；失败可重试/重建
查询只返回可见资源，不返回未授权文档
中文/短词走 trigram 兜底，不把“没有全文命中”当成“没有权限”
```

实现落点：`apps/api/src/search/`；契约：`schemas/search.schema.json`；
领域表：`DOMAIN.md`「搜索」；决策：`DECISIONS.md` D-13。

### 3.16 Review & Approval（复核/审批）

复核是**步骤链**，不是第二套工作流引擎：

- **ReviewStep**：`blueprint_approvals` 扩展 `round/kind/selector/assignee/checkProvider/checkResult/dueAt`。
- **AssigneeSelector**：`role` / `user` / `position`（可 anchor=record）/ `creator`；解析为空则阻塞。
- **CheckProvider**：机器检测走 `review.check` 任务；pass/fail/warn，异常/超时 fail-closed 为 fail。
- **WorkItem**：`work_items` 是待办投影，源表仍是 `blueprint_approvals` 等业务表。
- **Delegation**：`review_delegations` 记录代决定，审计保留原审批人与代理人。

执行语义：

```text
只有当前 pending 步骤的合法审批人可操作；越权 403
resubmit 创建新 round，旧 round 只读
机器检测 fail 阻断；warn 必须人工确认，不能当 pass
驳回后不得直接发布/迁移；整体 approved 才放行
SLA 到期提醒/升级幂等；无审批人必须告警，不静默通过
```

实现落点：`apps/api/src/review/`；契约：`schemas/review-approval.schema.json`；
领域表：`DOMAIN.md`「复核与审批」；决策：`DECISIONS.md` D-15。

### 3.17 Audit & Tamper Evidence（审计链）

审计是**只追加证据链**，不是业务状态：

- **AuditEvent**：`audit_logs` 一行；`seq` 按组织单调，`hash = SHA256(prevHash + canonical payload)`。
- **Checkpoint**：`audit_checkpoints` 记录某 seq 的 hash 与 HMAC 签名，作为验证锚点。
- **Archive**：`audit_archives` 存 JSONL 对象键与 manifest；清理只删已归档、非 legalHold、过期行。
- **Break-glass**：DDL 触发器拒绝 UPDATE/DELETE；只有 `app.audit_break_glass=on` 的保留期清理/恢复可例外，且必须留 `audit.break_glass` 审计。
- **Catalog**：已知 action 缺必填字段拒绝；未知 action 标 `source=custom` + 告警。
- **Retention**：`retentionClass → retentionUntil`；legalHold 阻止清理。

执行语义：

```text
审计只追加；业务代码不得 UPDATE/DELETE audit_logs
每组织 advisory lock 串行分配 seq；并发写入不得重号/断链
失败审计独立事务，业务回滚仍留痕
验证从最新 checkpoint 锚点向后重算；签名/链/hash 任一不符即失败
归档先写对象存储再标记 archivedAt；恢复需 break-glass 后重新验证
查询/导出本身也写审计（audit.query / audit.export）
```

实现落点：`libs/platform-core/src/audit-logs/` + `apps/api/src/audit-jobs/`；
契约：`schemas/audit.schema.json`；领域表：`DOMAIN.md`「审计」；决策：`DECISIONS.md` D-16。

### 3.18 Record Lifecycle（记录生命周期）

记录生命周期是**显式操作**，不是状态迁移：

- **Tree**：实体可选 `tree: { parentField, orderField }`；编译器校验字段存在/数值/自引用，运行时校验同组织/同蓝图/防环。
- **Clone**：深拷贝子树，生成新 ID，重映射内部引用；唯一字段策略 `fail/suffix/placeholder`；事务失败全回滚，`idempotencyKey` 幂等。
- **Move/Reorder**：跨父/同级排序；事务 + 乐观锁；记录前后父/序号。
- **Archive/Restore**：`archivedAt` 软归档，活跃列表隐藏；恢复校验父节点与唯一键；不物理删除。
- **Snapshot**：`record_snapshots` 保存 data/state/version/label；恢复创建新版本，不覆盖历史。
- **Operation**：`record_operations` 存 before/after/idempotency/操作者，并写审计。

执行语义：

```text
未声明 tree 的实体保持原 CRUD/状态迁移行为
成环/跨树移动拒绝，树结构不变
克隆唯一冲突 fail 时不产生部分克隆
归档不是状态迁移；活跃列表过滤 archivedAt
恢复旧快照创建新版本，旧版本保留
所有操作写 record_operations + audit_logs
```

实现落点：`apps/api/src/record-lifecycle/`；契约：`schemas/record-lifecycle.schema.json`；
领域表：`DOMAIN.md`「记录生命周期」；决策：`DECISIONS.md` D-17。

---

## 4. 不变量（Invariants）

评审与实现时的硬性判据。与第 1–3 节冲突时，以本节为准。

1. **元模型是类型系统，不是提示词。**
2. **大模型决定"要查什么"，Context Compiler 决定"实际塞什么"，Validator 决定"能不能用"。**
3. **判定权在平台/宿主，不在提交方**：哈希一律重算，不采信自述值。
4. **fail-closed 且不回退**：任一闸不过即拒，**不得**静默回退到内置实现。
5. **复现构建**：同源码 + 同锁定工具链 = 同字节 = 同哈希；哈希变即视为"换了一份代码"，必须重走准入。
6. **Wasm 源码零依赖**：依赖可携带 `build.rs` / proc-macro，会把审查面扩散到未审代码。
7. **零能力执行**：模块只有一块宿主注入、有上限的内存；无网络、文件、进程、系统调用。
8. **生产 Runtime 不含 Jev**：设计时生成与运行时执行分离；Design License ≠ Runtime License。
9. **客户拥有 Blueprint，平台控制 Runtime**：业务定义可迁移，核心实现不可导出。
10. **协议先行**：五个核心协议未冻结，不做大规模实现。
11. **不假设客户无法逆向**：目标是"拿不到可移植的核心实现"，而非"绝对不可逆"。
12. **一份判定逻辑只写一次**：准入侧与执行侧共享同一实现（两份必然漂移）。
13. **设计时产物一律表达为增量（Delta）**：不得旁路改写语义对象集合，
    也不得让 LLM 直接产出最终结构。
14. **数据范围只收窄**：最终可见 = 租户 ∩ 功能权限 ∩ 范围；范围不授予功能权限（INV-DS-01）。
15. **范围来自可信身份**：只从服务端身份/成员/策略解析，不接受客户端范围声明（INV-DS-02）。
16. **声明即执行**：声明 `dataScope` 即按范围过滤；未声明保持旧行为；解析失败按 none（INV-DS-03）。
17. **租户边界先于范围**：RLS 只做组织隔离，行级范围在应用层执行并可审计（INV-DS-04）。
18. **定义/实例分离**：蓝图模板 cap ∩ 租户策略，租户不得放大（INV-DS-05）。
19. **范围缓存按版本失效**：任何成员/策略/节点变更 bump `scopeVersion`（INV-DS-06）。
20. **任务真源在 PostgreSQL**：Redis 只做唤醒；worker 用 `FOR UPDATE SKIP LOCKED` 领取（INV-JOB-01）。
21. **至少一次 + 幂等**：唯一键 `(organizationId, type, idempotencyKey)`；handler 必须可重入（INV-JOB-02）。
22. **未知类型/非法 payload 不入队**：类型是启动时注册的白名单，payload 不执行任意代码（INV-JOB-03）。
23. **任务上下文来自可信身份**：组织/应用上下文不接受 body 覆盖；RLS 兜底（INV-JOB-04）。
24. **回调安全**：默认 https、禁私网/重定向、HMAC 签名；回调失败不改任务结果（INV-JOB-05）。
25. **多角色按组织**：有效权限 = 本组织 active 角色并集 ∪ 直授；`users.roleId` 仅作回退（INV-ID-01）。
26. **会话以 sid 为准**：JWT 携带 sid；吊销/过期后守卫必须拒绝，旧无 sid token 仅按过期时间兼容（INV-ID-02）。
27. **SSO/同步 fail-closed**：源不可用、签名/state/nonce 失败不得降级为信任调用方（INV-ID-03）。
28. **服务令牌不携带用户权限真相**：代用户调用必须服务端重解析权限与数据范围（INV-ID-04）。
29. **站内持久化优先于偏好**：偏好只影响 WS/额外投递；`mandatory` 绕过 mute（INV-NT-02）。
30. **公告 audience 同组织**：role/user/scope 只从服务端解析，跨租户节点拒绝，解析失败按空集合（INV-NT-01）。
31. **公告投递幂等**：唯一键 `(announcementId,userId)`；重复发布不产生第二条通知（INV-NT-03）。
32. **过期只软删除**：通知/公告/投递用 `deletedAt` 标记，统计与审计引用保留（INV-NT-04）。
33. **富文本不执行原始 HTML**：只渲染安全 Markdown 子集，链接协议白名单 http/https（INV-NT-05）。
34. **搜索组织隔离**：只返回同组织文档；跨租户查询为空或拒绝（INV-SE-01）。
35. **索引可重建**：索引是派生物，按 `(organizationId, resourceKey, resourceId)` 幂等 upsert（INV-SE-02）。
36. **索引只存可展示字段**：敏感字段不进入 `search_documents`（INV-SE-03）。
37. **索引失败不阻塞业务**：写入失败可重试/重建，业务事务不回滚（INV-SE-04）。
38. **无命中不等于无权限**：全文无命中时走 trigram 兜底，权限拒绝单独表达（INV-SE-05）。
39. **审批步骤只有合法审批人可操作**：role/selector/assignee 任一配置都必须满足（INV-RV-01）。
40. **机器检测 fail-closed**：异常/超时/未知 provider 记 fail；warn 不得当 pass（INV-RV-02）。
41. **轮次只追加**：resubmit 新建 round，旧 round 只读（INV-RV-03）。
42. **待办是投影**：work_items 不成为第二真源，源表变更/关闭后同步（INV-RV-04）。
43. **代决定留痕**：委托必须记录 from/to 与审计，不得静默替代（INV-RV-05）。
44. **审计只追加**：业务代码不得 UPDATE/DELETE `audit_logs`；break-glass 仅限保留期清理/恢复（INV-AU-01）。
45. **链连续**：每组织 seq 单调、prevHash 衔接、hash 可重算；并发不得重号/断链（INV-AU-02）。
46. **失败也留痕**：失败审计独立事务写入，业务回滚不丢失败证据（INV-AU-03）。
47. **检查点可信**：验证从 checkpoint 锚点开始；签名/链/hash 任一不符即失败（INV-AU-04）。
48. **保留期可执行**：legalHold 阻止清理；未归档/未过期不得删除（INV-AU-05）。
49. **查询/导出可审计**：访问审计本身写 `audit.query`/`audit.export`，敏感字段脱敏（INV-AU-06）。
50. **树完整性**：tree 父节点必须同组织/同蓝图；不得成环或跨树（INV-RL-01）。
51. **克隆原子性**：克隆在事务内完成，失败全回滚；唯一冲突不得产生部分节点（INV-RL-02）。
52. **移动并发安全**：移动/排序使用事务与乐观锁，并发至多一个成功（INV-RL-03）。
53. **归档不删除**：归档只设 archivedAt，活跃列表隐藏；恢复校验父节点/唯一键（INV-RL-04）。
54. **快照只追加**：恢复旧版本创建新版本，不得覆盖/删除历史快照（INV-RL-05）。

---

## 5. 工程元语

### 5.1 工作区与包管理器

```text
包管理器：npm（唯一锁文件 = 根 package-lock.json）
workspaces：shared-schemas / speckit / backend / wasm-modules
约定详见：docs/PACKAGE_MANAGER.md
```

### 5.2 文档真源（哪份文档负责什么）

项目已有成体系的结构化描述文档。**新增内容先往这些文件里放，不要另建新文件**：

| 主题 | 真源 | 备注 |
| --- | --- | --- |
| 基础定义（元模型、原语、不变量、术语） | **本文件** | 跨领域的定义层 |
| 平台总体设计（要做什么） | [`ERP_Space_Platform_设计方案_v3.md`](./ERP_Space_Platform_设计方案_v3.md) | 含路线图与差距 |
| 工程架构 / 目录与边界 | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Nx 项目、tags、依赖方向、运行拓扑 |
| 新增一个业务域 | [`architecture/add-a-domain.md`](./architecture/add-a-domain.md) | 以航运为样板：project / tags / 注册 / 路由 / 检查 |
| 业务域样板（航运） | [`domain-shipping`](../libs/domain-shipping/)、[`ui-shipping`](../libs/ui-shipping/) | 第一个 `domain-*` + `ui-*`，迁移与导入脚本在此 |
| 前端共享层 | [`ui-kit`](../libs/ui-kit/)、[`ui-runtime`](../libs/ui-runtime/)、[`ui-layout`](../libs/ui-layout/)、[`api-client`](../libs/api-client/) | 原子组件 / Schema 渲染 / 布局 / REST·WS 客户端 |
| 后端 Base Object 模式 | [`apps/api/docs/architecture/base-object-pattern.md`](../apps/api/docs/architecture/base-object-pattern.md) | 实体基类约定 |
| AI 模块的数据与安全 | [`apps/api/docs/ai-modules-database-and-security.md`](../apps/api/docs/ai-modules-database-and-security.md) | — |
| 后端开发指南 | [`apps/api/docs/developer-guide.md`](../apps/api/docs/developer-guide.md) | — |
| 工作流引擎（已退场） | [`protocols/workflow-consolidation.md`](./protocols/workflow-consolidation.md) | 旧树已删；能力去向与归档在此登记 |
| 前端运行时总体设计（历史） | [`通用_erp_前端运行时_speckit_v_1 (1).md`](<../通用_erp_前端运行时_speckit_v_1 (1).md>) | 根目录；理念来源 |
| 当前 vs 目标技术栈差距 | [`TECH_STACK_GAP.md`](./TECH_STACK_GAP.md) | — |
| 前端依赖实际版本 | [`TECH_STACK_v2.md`](./TECH_STACK_v2.md) | `libs/app-shared/README.md`（若存在）与根 README 以上游模板为主，不可作版本依据 |
| 包管理器与依赖安装 | [`PACKAGE_MANAGER.md`](./PACKAGE_MANAGER.md) | — |
| Wasm 原子模块与准入门禁 | [`wasm-modules/README.md`](../wasm-modules/README.md) | — |
| 汽配计算原子 ABI | [`protocols/autoparts-atoms.md`](./protocols/autoparts-atoms.md) | ATP / 价格 / 信用 / 换算 / 替代链；查库能力不做原子 |
| Wasm 执行引擎（sidecar） | [`crates/wasm-host/`](../crates/wasm-host/) + openspec change `add-wasmtime-host` | V8 实现见 `apps/api/src/atomic-runtime/wasm-instance-pool.ts` |
| 蓝图交付 / 授权 / 经验策略 | [`protocols/blueprint-delivery.md`](./protocols/blueprint-delivery.md) | 分层、编译期判据、验签链、开发豁免 |
| 蓝图 IR | [`protocols/blueprint-ir.md`](./protocols/blueprint-ir.md) | 结构 / 文本双形态 |
| 记录迁移历史 / 建议迁移 / `metadata.source` | [`protocols/record-transition.md`](./protocols/record-transition.md) | 读语义、只读契约、夜间建议生产者、双跑期审计来源 |
| 旧工作流退场 / 只读归档 | [`protocols/workflow-consolidation.md`](./protocols/workflow-consolidation.md) | 410 墓碑、逐条退场理由、四表归档、净损失与回归时机 |
| Outbox（跨进程事件） | [`protocols/outbox.md`](./protocols/outbox.md) | 事件形状 / 幂等键 / 投递语义 / 重试；进程内总线不走此协议 |
| 最小可观测（结构化日志） | [`protocols/observability.md`](./protocols/observability.md) | 不做 OTel/Prometheus；N3 只做结构化日志 + 投递失败可定位 |
| 通知 / 审批待办 | [`protocols/notifications.md`](./protocols/notifications.md) | 持久化通知、两层去重、角色→用户、`GET /inbox` |
| 变更提案与任务清单 | `openspec/changes/<change-id>/` | 按 OpenSpec 流程 |
| Git 工作流 | [`openspec/GIT_WORKFLOW.md`](../openspec/GIT_WORKFLOW.md) | — |
| 项目上下文（AI 助手入口） | [`openspec/project.md`](../openspec/project.md) | — |

**入口分层**（避免在 `AGENTS.md` 里维护扁平清单）：

```text
AGENTS.md（仓库级：元语 + 3 条硬规则）
   ↓
docs/META_LANGUAGE.md（定义层） + openspec/project.md（上下文） + openspec/AGENTS.md（流程）
   ↓
本表（文档真源）→ 各子系统的结构化文档

子目录另设作用域入口：`apps/api/AGENTS.md`（索引本目录 docs/）；前端按 app 分治，共享层入口见 `docs/ARCHITECTURE.md` §1
```

### 5.3 变更流程

新能力 / 破坏性变更 / 架构调整 → **先立 OpenSpec change proposal**（`openspec/AGENTS.md`），
批准后再实现；实现完成后归档到 `openspec/changes/archive/`。

---

## 6. 术语表

| 中文 | English | 代码标识符 / 落点 | 状态 |
| --- | --- | --- | --- |
| 元模型 | Meta Model | `Ω`；`ObjectSchema` | 🟡 部分 |
| 语义对象 | Semantic Object | `ObjectSchema` | ✅ |
| 原子契约 | Atomic Contract | `atomicType`、`AtomicContract`、`schemas/atomic-contract.schema.json` | ✅ |
| 原子模块 | Atomic Module | `wasm-modules/modules/*` | ✅ |
| 执行引擎 | Wasm Engine | `WasmEngine` 接口；`crates/wasm-host`（Wasmtime）/ `WasmInstancePool`（V8） | ✅ |
| 原子实现 | Atomic Implementation | `AtomicImplementation.moduleSha256` | ✅ |
| 模块清单 | Module Manifest | `wasm-modules/build/manifest.json` | ✅ |
| 准入层级 | Admission Tier | `AdmissionTier = "A" \| "B"` | ✅ |
| 准入状态机 | Admission Status | `submitted → built → tested → shadow → canary → active` | ✅ |
| 审查背书 | Review Attestation | `ReviewAttestation` | ✅ |
| 复现构建 | Reproducible Build | `reproducibleBuildRef` | ✅ |
| 静态闸 | Static Gate | `staticGate()`、`StaticGateError` | ✅ |
| 源码闸 | Source Gate | `sourceGate()`、`SourceGateError` | ✅ |
| 吊销名单 | Revocation List | `RevocationList`、`assertNotRevoked()` | ✅ |
| 业务蓝图 | Blueprint | `blueprint.json`（作者元数据）+ 分层文件 | 🟡 |
| 蓝图包 | Blueprint Package | `.erpkg`；`schemas/blueprint-package.schema.json`；`BLUEPRINT_PACKAGES_DIR` | ✅ |
| 蓝图 IR | Blueprint IR | `blueprint-ir/v1`；`schemas/blueprint-ir.schema.json` | ✅ |
| 编译记录 | Compiled Record | `manifest.compiled.irDigest`、`stampCompiled()` | ✅ |
| 原子绑定 | Atomic Binding | `AtomicBinding`（契约版本 + `moduleSha256` + tier） | ✅ |
| 最小蓝图导出 | Minimal Blueprint Export | `buildMinimalBlueprint()`、`POST /api/module-registry/:id/export-blueprint` | ✅ |
| 输出管控判据 | Output Audit Criterion | `output-gate.ts` 的 O1–O5 + S1；`atomic.output.O<n>` 协议码 | ✅ |
| 影子发布证据 | Release Evidence | `AtomicImplementation.releaseEvidence`、`shadow-release.ts` | ✅ |
| 能力胶囊 | Capability Capsule | — | ❌ |
| 增量协议 | Delta | `space-delta/v1`（协议标识）；现有 `PatchScope`/`PatchOperation` | 🟡 |
| 上下文编译器 | Context Compiler | `ContextEnvelope` | ❌ |
| 设计时模型 | Jev-like LLM | `DeltaGenerator`/`DeltaRepairer` | ❌ |
| 运行时 AI | Agent Host | — | ❌ |
| 模块注册表 | Module Registry | `apps/api/src/module-registry/` | ✅ |
| 经验策略 | Experience Policy | `experience.json`；`schemas/blueprint-experience.schema.json` | ✅ |
| 交互面 | Interaction Surface | `interaction-plan/v1`；`schemas/interaction-plan.schema.json` | 🟡 |
| 业务应用安装 | Business App Installation | `BusinessAppInstallation`；`app_installations` | 🟡 |
| 应用执行上下文 | Business App Execution Context | `BusinessAppExecutionContext` | 🟡 |
| 蓝图授权声明 | Blueprint License | `license.json`；`manifest.signature`；`apps/api/src/blueprint/license.ts` | ✅ |
| 主从结构 | Header-Line | `children` / `parent`；头行一件事务 | ✅ |
| 唯一性 | Uniqueness | `unique: true` → DB 唯一索引（按租户/蓝图隔离） | ✅ |
| 金额精度 | Money Precision | `decimal(p,s)` + `apps/api/src/blueprint/money.ts`；禁止浮点 | ✅ |
| 数据范围 | Data Scope | `ScopeEvaluator` / `ScopeSqlCompiler` / `DataScopeService` | 🟡 |
| 范围节点 | Scope Node | `ScopeNode`；`scope_nodes` | 🟡 |
| 范围成员 | Scope Membership | `ScopeMembership`；`scope_memberships` | 🟡 |
| 数据策略 | Data Policy | `DataPolicy`；`data_policies` | 🟡 |
| 异步任务 | Async Job | `Job`；`jobs`；`libs/platform-core/src/jobs/` | 🟡 |
| 任务尝试 | Job Attempt | `JobAttempt`；`job_attempts` | 🟡 |
| 任务事件 | Job Event | `JobEvent`；`job_events` | 🟡 |
| 任务回调 | Job Callback | `JobCallbackService`；HMAC-SHA256 | 🟡 |

---

## 7. 本次会话沉淀索引

| 会话产物 | 在元语里承载什么 |
| --- | --- |
| [`ERP_Space_Platform_设计方案_v3.md`](./ERP_Space_Platform_设计方案_v3.md) | 第 1–3 节原语的展开与出处（v1+v2 融合、冲突消解、路线图） |
| [`TECH_STACK_GAP.md`](./TECH_STACK_GAP.md) | 第 2 节各协议"状态"列的判定依据；Rust 触发条件 |
| [`TECH_STACK_v2.md`](./TECH_STACK_v2.md) | 前端维度的实际事实（纠正了上游模板残留） |
| [`wasm-modules/`](../wasm-modules/README.md) | 第 3.2、3.3 节的实现（ABI v1 + 闸 0/1/2/5） |
| [`openspec/specs/atomic-registry/`](../openspec/specs/atomic-registry/spec.md) | 第 2 节协议 2 的落地规格（执行链另见 `wasm-atomic-runtime`） |
| [`openspec/changes/add-blueprint-package-and-compiler/`](../openspec/changes/archive/2026-11-11-add-blueprint-package-and-compiler/proposal.md) | 第 2 节协议 3/4 的落地提案；第 3.8 节的实现设计在其 `design.md` |
| [`PACKAGE_MANAGER.md`](./PACKAGE_MANAGER.md) | 第 5.1 节工程元语 |

---

## 8. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| 1.14 | 2026-10-18 | 新增 §3.10「Business App Installation」：在 Organization 与 Blueprint 之间建立租户内应用运行边界；$C$ 补应用实例；术语表补业务应用安装与应用执行上下文；租户请求改用事务上下文 + PostgreSQL RLS |
| 1.13 | 2026-09-27 | 新增 §3.9「Interaction Surface（临时交互面）」：一次意图的可视化投影，确认或取消后即消失。真源见 `protocols/chat-erp.md` |
| 1.12 | 2026-09-27 | §5.2「建议迁移」真源补夜间生产者。见 `protocols/record-transition.md` §2.1 |
| 1.11 | 2026-09-26 | §5.2 补最小可观测真源。见 `protocols/observability.md`（明确不做 OTel/Prometheus） |
| 1.10 | 2026-09-26 | §5.2 补通知 / 审批待办真源。见 `protocols/notifications.md` |
| 1.9 | 2026-09-26 | §5.2 补 Outbox 真源；$\Lambda$ 落点改为跨进程 outbox + 进程内 EventBus。见 `protocols/outbox.md` |
| 1.8 | 2026-09-26 | §5.2 补「旧工作流退场 / 只读归档」真源；$\Sigma$ 落点改为蓝图 flows + 记录迁移，旧 `workflow_*` 四表只读归档。见 `protocols/workflow-consolidation.md` |
| 1.7 | 2026-09-26 | 协议 3 / §3.8.1 / 术语表补「主从结构 / 唯一性 / 金额精度」三条语义层落点，真源指向 `schemas/blueprint-semantic.schema.json`、`docs/protocols/blueprint-delivery.md`、`apps/api/src/blueprint/money.ts` |
| 1.6 | 2026-09-25 | 协议 3 补规则 / 经验策略 / 授权三层；协议 5 推进到 🟡（蓝图 Ed25519 验签落地，加密仍待）。§3.8 装载链改为七道关。术语表补 Experience Policy（与 Interaction Surface 配对）与 Blueprint License。交付判据见 `protocols/blueprint-delivery.md` |
| 1.5 | 2026-09-25 | 新增 §3.5.1「插件沙箱（与原子同一套能力模型）」：边界 / 声明 / 判定 / 失败 / 审计 / 静态检查六个维度逐项对照，并写明已知边界（Node 权限模型不覆盖出网） |
| 1.4 | 2026-09-25 | §3.3 闸表补齐：闸 3（输出管控）与闸 4（影子发布）从 ❌ 改为 ✅ —— 闸 3 的判据文本在 `protocols/atomic-output-audit.md`、实现见 §3.8 同级的 `output-gate.ts`；闸 4 的证据门在 `atomic-registry/shadow-release.ts`。术语表补"输出管控判据 / 影子发布证据"两行 |
| 1.3 | 2026-09-25 | 协议状态位推进：协议 2（Atomic Contract）📋 → ✅ 已冻结；协议 3（Blueprint Package）❌ → 🟡（包与 IR 已冻结，表单/规则/BOM/审批层待补）；协议 4 补加载链落点。新增 §3.8「Blueprint 编译与加载链」，术语表补 IR/编译记录/原子绑定/最小蓝图导出四行 |
| 1.2 | 2026-09-24 | 补入口分层：新增 `speckit/AGENTS.md`、`apps/api/AGENTS.md` 两个作用域入口；`openspec/AGENTS.md` 的 Context Checklist 与 Stage 1 步骤纳入本文件；§5.2 补 Clerk 文档行并标注为待清理残留 |
| 1.1 | 2026-09-24 | 按反馈修正：移除上一版加入的 space 相关表述（本文件只做结构化系统描述，不引入新概念词）；§5.2 文档真源表改为**索引项目已有的结构化文档**（speckit/docs、backend/docs、openspec），明确"新增内容先放入既有文件，不另建新文件" |
| 1.0 | 2026-09-24 | 首次建立：从本次会话（设计 v3、技术栈差距、Wasm 原子模块、变更提案、包管理器收敛）提炼元模型、协议与执行原语、不变量、术语表与文档真源 |

## 9. 参考包并入：发布 / PiAgent / 进化闭环

以下内容由 `docs/reference` 参考包并入，权威落点如下：

| 主题 | 真源 | 关键不变量 |
|---|---|---|
| 工程架构（Nx/Next/Nest/PG/Redis） | `docs/ARCHITECTURE.md` | `INV-META-*` |
| Release / Activation / Rollback | `docs/protocols/release.md` + `DOMAIN.md` | `INV-REL-01..10` |
| PiAgent 双 profile / Context Envelope / 工具面 | `docs/protocols/piagent.md` | `INV-AGENT-01..12` |
| Agent 自主进化 / A0–A3 / A2 | `docs/protocols/agent-evolution.md` | `INV-EVO-01..10` |
| 四份机器可校验契约 | `DOMAIN.md` / `FLOWS.md` / `DECISIONS.md` / `AGENT-TOOLS.md` | `INV-META-01..05`, `INV-DATA-01..07`, `INV-FLOW-01..04` |

**发布三动词**：`deploy`（部署进程）≠ `publish`（生成不可变 Release）≠ `activate`（对租户/cohort 生效）。
**Agent 三不拥有**：不拥有事实（事实在工具结果）、不拥有规则（规则在 `Φ`/`Σ`）、不拥有发布权（发布在 `V`）。
**A2 边界**：Agent 仍只提议；发布由平台 `release-automation` 策略服务执行，`actorAgent` 为空。
