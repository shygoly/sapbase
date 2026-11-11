# Change: 收紧模型凭据、知识范围与真实工具证据

## Why

本变更固定于 **weichen `ce1e538dcec6539f66bba80d5413a3b6741486c9`**，推进顺序 **01**，优先级 **P0：凭据/知识越权与虚假执行事实阻断；生产自治保持关闭**。前置 `refactor-ai-native-control-plane-boundaries` 提供确定性 Kernel、Agent Host、可信主体和平台治理边界；其接口批准即可开始隔离开发，不等待后续联合验收。main 的旧报告、离线复现和测试数量不作为此基线事实。

### 当前已实现与剩余证据

| 新基线事实与实际消费者 | 剩余缺口 / 取舍 |
|---|---|
| `apps/api/src/app.module.ts:113–138` 装配 AIModels、AgentTools、Sessions、Knowledge、Eval、ReleaseAutomation；不是依据目录名判断归属。 | 本文只审查这些消费者相关信任边界，不扩展成全平台审计。 |
| `apps/api/src/ai-models/ai-models.controller.ts:10–49` 调用同目录真实服务；`ai-models.service.ts:14–51` 返回实体，`ai-model.entity.ts:24–40` 默认加载 apiKey 与任意 config。`libs/platform-core/src/common/interceptors/response.interceptor.ts:18–31` 仅包装响应。 | 默认端点只需登录；所有读取与写回执仍需无秘密 DTO。未请求真实接口、未读取真实 key，不能宣称发生外泄。 |
| `apps/api/src/ai-modules/ai-modules.service.ts:50–66` 加载 aiModel 关系，`ai-modules.controller.ts:43–61` 将其返回；`libs/api-client/src/api/ai-models.api.ts:3–16` 仍含 apiKey，经 app-shared 兼容导出进入 `apps/web-console/src/app/admin/ai-models/components/ai-model-form.tsx:38–48`。 | 不仅修模型端点，还需堵住嵌套模型对象及管理表单回填。模型内部消费者须迁到受控解析接口，不以公开 DTO 删除字段后直接破坏调用为完成。 |
| `apps/api/src/agent-knowledge/agent-knowledge.service.ts:33–39,75–86,105–126` 在分配版本、替换和回滚历史来源中缺组织谓词；`:135–140` 技能按全平台 skillKey 分配版本。控制器 `:10–59` 使用组织/通用权限，没有独立 global 管理授权。 | 补完整知识/技能命名空间、可信范围与发布事务；历史由 rollback 消费，当前不存在独立历史查询 HTTP 接口，不虚构其已暴露。 |
| `libs/platform-core/src/common/rls/release-agent-rls.ddl.ts:15–21,47–64` 已为知识/技能提供 RLS：组织写受限，NULL 组织行 SELECT 未限制 status/scope。迁移 `apps/api/src/migrations/1792900000000-EnableReleaseAgentRls.ts:10–11` 存在，但常规 `data-source.ts:20–41` 未列入知识创建/该 RLS 迁移。 | 旧跨租户离线例不能直接证明现部署可利用；RLS 部分缓解不等于完整命名空间修复。只收紧知识/技能策略、NULL 唯一和专项迁移接线，不重建通用 RLS。 |
| Registry 真源为 `libs/agent-tools/src/agent-tool.registry.ts`；API 文件仅 re-export。`:119–155` 已有白名单/参数/权限/确认/数据范围硬拒，`:202–225` 调用共享 DataScopeGuard；`apps/api/src/agent-tools/agent-tools.module.ts:43–81` 实际注入它。MCP 桥 `libs/agent-tools/src/mcp/agent-tool-mcp.bridge.ts:70–85,119–130` 委托同一 Registry。 | 保留这些实现，不重复造网关/范围算法。拒绝发生在真实审计 try 之前；`:157–193` 仅执行后 success/failure 审计，缺持久开始/拒绝/结果引用。actor 在 HTTP 消费者中常为 email，必须另传稳定 userId，不能伪称已获完整身份证据。 |
| `apps/api/src/chat/chat-orchestrator.ts:49–56` 写操作只形成计划；会话 `apps/api/src/agent-sessions/agent-sessions.service.ts:119–136` 却按 trace 工具名生成 hash({})、permissionOk=true 和 success。 | 仍证实虚假事实生成路径；本次仅静态确认，不称真实工具已越权执行。需用 Registry 事件投影替代。 |
| `apps/api/src/agent-eval/agent-eval.service.ts:46–99` 接受 caseResults 自报；真实发布验证为 `libs/platform-release/src/releases/release-validation.service.ts:61–82,188–192`。新 G4 已消费持久测试证据（`:145–151`），`apps/api/src/releases/releases.module.ts:59–65` 已装配。 | 不再写“没有测试证据系统”。G4 只按组织/app/时间查找，不绑定 candidate，禁执行仍可 passed（`:154–155`）；G5 自报与 URL 非空仍非真实验收。本文仅建立早期拒绝，完整 runner/G0–G8 由顺序 09 负责。 |
| `libs/platform-release/src/releases/releases.service.ts:31–38,298–359` 默认开启且 publish 不消费真实门禁；`release-automation/release-automation.service.ts:96–136` 可按应用开关发布；`release-automation-jobs.service.ts:19–33` 无指标也写 success。 | 必须阻断生产新候选发布/激活与 A1/A2 放行；文档生成或扫描 policy 不是生产关闭证据。A2 分类、指标窗口与恢复资格留给顺序 10，不复制无依据数字。 |

## What Changes

- `ai-model-security`：模型对象（含嵌套关系）统一公开白名单 DTO；apiKey 只写不读，省略保留、空白拒绝、显式清除互斥；服务端配置只存受控引用，真实内部模型消费者经专用解析端口使用凭据。
- `agent-knowledge`：所有知识/技能版本操作使用可信命名空间，global 管理独立平台权限；发布替换/回滚同域事务、NULL 安全唯一和收紧已有 RLS。保留已有知识提议、独立审核、敏感检查与版本绑定要求，不重造全套知识产品。
- `chat-erp`：所有 direct/MCP/会话工具执行沿同一 Registry 生成真实持久生命周期；拒绝也留痕，计划/待确认不算成功；历史无来源记录标为未核实，结果未知不盲重试写。
- `chat-erp`：平台端早期生产证据策略默认拒绝，真实 runner 与必需证据未验收前不能发布/激活新生产候选或放行 A1/A2。受控隔离候选可先评测，既有稳定安装继续确定性运行。

**BREAKING**：任何客户端均不能再读 apiKey/任意敏感 config/credentialRef；越范围知识与 global 通用组织管理拒绝；旧 trace-success、自报 EvalRun、非绑定测试缓存不再有成功/上线证据效力。不得通过恢复旧返回字段或 warn 放行保持兼容。

## Impact

### 已有 changes/specs 的关系

正式 specs 中已有 `ai-module-management` 和 `data-scope`，没有 `ai-model-security`、`agent-knowledge`、`chat-erp` 的正式条款。本文三项 delta 均使用**独立补充标题的 ADDED**，共 7 条，不部分 MODIFIED 正式条款、不复制 pending 全功能规格。

| 既有工作 | 本变更只补什么 |
|---|---|
| `add-agent-knowledge-and-eval` | 完整命名空间、global 授权、并发/NULL/RLS、真实来源资格；其知识审核与 Release 检索仍适用，warn 不能用于生产。 |
| `add-chat-first-erp` / `add-piagent-runtime-context-and-session` | 计划与事实的区分及真实事件投影；不重建上下文、预算、确认全绑定、取消、多轮/SSE。 |
| `add-agent-host-and-instance-evolution` | 复用已接线 MCP/Registry 的审计源；不重做宿主或推定外部部署已通过。 |
| `add-generic-data-scope-authorization` / 正式 `data-scope` | 保留共享范围闸，专项验证可信主体与拒绝事件；不重建原语、树、策略或全消费方。 |
| `add-audit-compliance-and-tamper-evidence` | 复用 `libs/platform-core` 审计写入/追加保护，工具 attempt 事件是领域事实，不再建立第二套审计哈希链。 |
| `add-a2-release-automation` / `add-builder-governance-loop` | 早期生产禁入覆盖策略与后台入口，扫描/自报不能放行；完整 A2 治理后置。 |

### 接口、依赖与非目标

唯一硬前置为顺序 00；复用现有 PG jobs、identity、data-scope、Registry 和 Nx workspace 拓扑，不因 pending 文档未归档而重做已存在基础。待新增设计接口 `ModelPublicDto/ModelSecretWriteDto/ModelCredentialResolver`、`KnowledgeNamespace`、`RegistryExecutionEvidencePort`、`ProductionEvidencePolicy` 见 design，均不是当前已实现 API。

顺序 04 提供确定性命令/结果引用；05/06 消费早期拒绝并负责冻结候选、签名、安装有效版本；07 提供完整可信上下文、确认绑定、预算/取消并消费真实事件；09 提供 candidateDigest 绑定的实际评测/GateDecision；10 在 A1 验收后才申请有限 A2。后置联合验收不阻断前段隔离开发。

不修改业务 Kernel/Registry 唯一授权入口、Blueprint/Delta 格式、金额库、安装事务、插件隔离、cookie/BFF、CI 拓扑、交易算法或技术栈；不把模型/知识正文作为权限，不定义完整 runner、A2 窗口、自治部署或源码进化。本次仅改提案，不 apply、运行服务、连接真实库/模型、部署或归档。

### 验收出口

后续实施必须交付同 SHA 的真实 HTTP/浏览器无秘密响应与表单证据；非 owner/非 superuser/无 BYPASSRLS 真 PG 的双组织、部门/个人/global、NULL/首次并发/事务失败与 USING/WITH CHECK 拒绝证据；待确认 invoke=0/成功=0、真实成功/异常/每类拒绝事件与业务结果可核对；生产开关、后台入口、自报/空/混候选证据不得放行。记录实际版本、角色、迁移、执行/失败/跳过/断言数量，前置失败/零断言不能 PASS。完整真实模型评测和生产放行仍等待 09/10，不因本 change 格式校验或文档提交自动关闭 P0。
