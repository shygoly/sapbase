# Change: 当前实例的可信 A1、有限 A2 与源码交付准入

## Why

本提案重新审查 `weichen` 基线 `ce1e538dcec6539f66bba80d5413a3b6741486c9`，不沿用 main 的复现结论或测试数字。当前实例已具备反馈/topic、提案/审批、内嵌 MCP 投影、Registry profile 判定、发布/安装记录和 PostgreSQL jobs；需要补的是这些能力间的可信身份、候选证据关联与实际自治准入，而不是重建 AgentHost 或整套发布平台。

当前真实运行链仍显示：反馈请求的 release/trace/tool 引用未经核验；Builder 没有已接通的可信主体入口，且未声明 allowedAgents 的工具会放行任何 profile；A2 HTTP 接口接受自报 changeClasses 与独立 manifest，资格不检查应用白名单交集，护栏无指标仍写 success，晋级直接到全量。源码部署只是 queued 存根，不能称为已部署，也不能据此宣称存在热改生产的已利用漏洞。上述剩余缺口足以保留本 same-id change。

## What Changes

### 顺序、优先级与前置

顺序 **10：先真实 A1，后有限 A2**；优先级 **P1 / A2 后置**。A2 当前入口的关闭、无指标拒绝与默认拒绝由前段安全/发布工作先落实，本 change 消费其结果，不把后置 A2 开发误当 P0 生产许可。

直接接口/联合验收依赖：

- `connect-runtime-ai-context-and-tool-lifecycle`：可信主体/profile、ContextEnvelope、预算/取消及实际 Registry 调用。
- `integrate-versioned-schema-human-ai-workbench`：同版本工作台、草稿编辑与真实治理视图。
- `harden-approved-release-artifact-integrity`：服务端 Delta、冻结候选、可信审批与完整签名制品。
- `unify-effective-release-activation-and-recovery`：有效 ReleaseContext、稳定 cohort、安装事务与兼容恢复。
- `run-candidate-bound-evaluations-and-release-gates`：同候选摘要真实测试/评测、预览及最终 GateDecision。

架构、安全、构建、共享命令与可靠事件通过这些依赖传递。反馈核验、profile 收窄、分类拒绝集可先隔离开发；A1 发布与 A2 启用的联合验收后置，不要求完成全部外部宿主/回流能力才开始前段开发。

### 具体增量

1. 在已有反馈/topic 上核验组织、安装、实际使用 releaseDigest 和真实事件引用；脱敏及不可信包装必须在实际 Builder 消费路径生效。现有 24 小时反馈去重范围保留，但补可追溯计数、screen/安装边界和 NULL 正文处理。
2. 服务端签发受限 Builder 主体，只允许候选 namespace 内的既有 builder_* 工具；缺 allowedAgents 不能被 Builder 当通用授权，特别拒绝带服务器 dir/out 的 erp_module_export。保留唯一 Registry 和 MCP 投影，不增加 shell/任意 URL 工具。
3. 以既有 PG jobs 注册阶段 handler，追加反馈→topic→Delta 修订→冻结候选→真实证据→审批→签名制品→实际安装→效果的关联，不新增第二套任务引擎。消费 `add-agent-host-and-instance-evolution` 的 platformVersion/evolutionScope 与实例边界；缺实际绑定不补造版本、不完成闭环。
4. **BREAKING**：A2 发布只消费冻结候选引用与有效 policy 修订，不再把 changeClasses/manifest/clean/客户端指标当权威事实。平台分析完整 diff，按平台与应用白名单交集判定；首类提议限无业务语义、非模型提示词的普通展示帮助/字段提示。
5. 配置 enabled 与实际资格分开。A2 预授权必须由独立人批准的 policy 在可信审批服务实例化为同候选凭证；无法满足前置审批契约就继续 A1。真实测试评测缺失始终禁止生产自治。
6. 真实来源、分母、样本、水位与稳定 cohort 的窗口驱动晋级/兼容回退；缺指标为 unavailable。按逐次发布复核、持久撤销 epoch 与全 policy 审计落实停止/恢复。窗口、样本、档位与资格次数来自批准的版本化 policy，不照搬 UI 的默认数字作已批准政策。
7. 源码交付只补外围 PR/隔离构建/同 SHA 真实证据/独立批准/签名不可变工件/受控部署和兼容恢复的准入；不实现新的生成器或部署平台，不给 Runtime/Builder 生产密钥和宿主权限。

## Impact

### 当前已实现与剩余证据

| 新基线证据 | 当前事实与本次取舍 |
| --- | --- |
| `apps/api/src/app.module.ts:129–137`；`apps/api/src/agent-tools/agent-tools.module.ts:43–81`；`apps/api/src/release-automation/release-automation.module.ts:11–15` | API 装配真实服务。Registry 实现在 libs/agent-tools，A2 实现在 libs/platform-release，apps/api 下对应文件为 re-export 壳，不按旧目录下结论推断。 |
| `apps/api/src/chat/chat-orchestrator.ts:59–75`；`libs/agent-tools/src/mcp/agent-tool-mcp.bridge.ts:70–85,119–146,173–184` | MCP 真实接回同一 Registry，并用一次性引用传可信上下文；保留，不再要求新建 MCP。现有 list 收窄来自进程 env，不是用户 Builder 身份签发。 |
| `libs/agent-tools/src/agent-tool.registry.ts:98,121,244–256,315–362`；`contracts/tools.json:126–155` | 既有 builder_* 没有 approve/publish/activate，但 missing allowedAgents 默认放行、Builder 禁用函数无调用点、提案作者人字段丢失。新增收窄与可信入口，不能声称 HTTP 已能伪造 profile。 |
| `apps/api/src/agent-feedback/agent-feedback.controller.ts:17–35`；`apps/api/src/agent-feedback/agent-feedback.service.ts:29–66,77–113` | org/user 来自服务端，正文有基础脱敏和包装函数；release/cohort/trace/tool 仍透传。去重直接返回旧行，未记录频次；Builder list 实际返回 raw 行，包装函数未接入。 |
| `libs/platform-release/src/releases/releases.service.ts:95–137,165–192,300–368` | 已有草稿归属和硬字段检查；不是可核验 Delta/证据关联闭环，发布仍独立输入。审批/冻结/签名由前置 05 修，不在本 change 重造。 |
| `libs/platform-core/src/jobs/job-queue.ts:69–109,216–280,312–395`；`job-worker.ts:170–225` | PG 入队幂等、领取、租约、事件、取消/Abort 基础存在；本主题只接注册 handler、阶段事实和副作用 fencing，不能说 jobs 全缺或已真库验收。 |
| `libs/platform-release/src/release-automation/release-automation.service.ts:63–93,96–149,186–247`；`release-automation-jobs.service.ts:19–58` | policy 入参已补必填校验，默认 enabled=false；删除“漏 allowedChangeClasses 抛 500”的修复项，仅回归。自报分类、应用子集缺失、无指标 success、直接全量、clean 自增、首 policy 审计和 policy 时间复核仍在真实消费者。 |
| `apps/web-console/src/app/admin/release-automation/page.tsx:80–93`；`libs/api-client/src/api/agent-governance.api.ts:56–67` | 真实页面会写 enabled=true 与硬编码阈值，不是 mock。需要显示资格/证据状态，不能把“已启用”当治理验收通过。 |
| `.github/workflows/ci.yml:169–189,240–247,307–309`；`scripts/ci/pipeline.sh:1–9`；`libs/platform-release/src/releases/release-validation.service.ts:145–155` | 三内核及平台库已进入实际 CI 构建，旧 main 漏构建项从本主题删除。统一 CLI pipeline 和测试证据已新增，但缓存证据只按 org/app/freshness 取；同候选/SHA和真实门禁由 03/09 收紧。 |
| `apps/api/src/system/system.service.ts:7–13`；`.github/workflows/release.yml:21–47` | deploy 为无实际部署的 queued 存根，标签发布只生成说明。新增外围交付准入，而非宣称已有生产热改/部署漏洞。 |

本次仅静态阅读代码、DI/import/HTTP/前端消费者和 OpenSpec。没有运行模型、PostgreSQL、Redis、浏览器、宿主、调度、构建或部署；OpenSpec strict 校验不等于生产测试通过。不使用 main 的离线探针、诊断数或测试计数。

### 与已有 changes/specs 的关系

`agent-governance`、`release-automation`、`instance-evolution`、`agent-host` 在正式 `openspec/specs` 尚不存在，分别由 pending changes 定义；本提案只以 ADDED 增加独立可信接线/准入条款，不伪造 MODIFIED 正式原文。

- `add-agent-host-and-instance-evolution` 已覆盖宿主、实例范围、版本绑定、回流和冲突检测；不重做其拓扑/MCP/回流。只要求本主题链消费已核验 platformVersion/evolutionScope，不能据 `[x]` 推定闭环已完成。
- `add-builder-governance-loop` 已覆盖反馈、工具面、硬提案与治理台；本提案收紧实际身份/引用/执行状态，保留现有人工 ai_modules 草稿入口。
- `add-a2-release-automation` 已定义白名单、策略发布、灰度/回退/复核；本提案收紧真实 diff、policy 审批实例、指标与撤销/全量审计，不复制旧全功能清单。
- `add-full-system-generation-and-deploy` 只建立高权限 API/存根；本提案只增加源码交付证据和职责分离边界，具体生成/部署实施仍需独立授权。

### 兼容与不做什么

历史反馈/proposal/run 保留只读，缺权威关联标 legacy_unverified，不猜历史摘要或 clean 次数。旧 policy 默认迁为 disabled/pending_review；旧自动发布 manifest 接口停止执行并返回迁移指引，旧建议字段可显示但无授权效力。已有 API 前端类型按 08 的兼容方案过渡。

保留 Nest/React/Next、TypeORM/PG、Nx/npm、单实例宿主与已有安装事务/数据范围/身份。Kernel 确定性、Registry 唯一入口、Blueprint/Delta 与单金额库不改；不新建业务流程/任务引擎、MCP 清单、源码生成器或部署架构。不审核所有新增平台能力，不直接更新权威 docs、台账或业务代码；不 apply/archive/启动服务/部署。

### 验收出口

1. 隔离真实 A1 从反馈追到使用版本、topic、Delta、candidateDigest、真实测试评测/预览、独立人批准、签名未公开制品、最终 GateDecision、published、实际安装和有效效果窗口。顺序不要求先 published 才评测；修改 diff 重新冻结和取证。
2. 假引用、假 profile、缺 allowedAgents 越界工具、恶意反馈、候选凭据访问生产均在副作用前拒绝。取消/租约丢失/重启/重放不重复发布或覆盖终态；只有实际效果验收后完成链。
3. 前置真实门禁未验收、必需证据 missing/unavailable/skipped 时生产自治关闭；既有稳定安装继续确定性运行，隔离开发证据不能转生产许可。
4. A2 首类完整 diff 拒绝集、同候选审批实例、真实 service principal、批准 policy 的窗口/样本/cohort/档位以及兼容恢复可重算。无指标、错标、空 diff、结构/语义夹带、policy 撤销和提交竞争拒绝。
5. 每次发布复核、资格恢复和组织内全部 policy/run 的审计有实际关联；源码 PR 的同 SHA 构建/必需测试/独立批准/签名/目标与恢复有受控环境证据。不存在实际部署时显示 blocked/unavailable，不生成部署成功。
6. 获本提案批准后实施，完成实际断言、源 SHA/候选/policy摘要、provider/数据库/浏览器版本及限制报告和既有真源同步，才申请归档。本次没有满足这些生产出口。
