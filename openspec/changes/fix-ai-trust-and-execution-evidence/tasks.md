# 实施任务：凭据、知识范围与真实执行证据

本次只做 weichen 静态复核和 OpenSpec 格式校验。下列任务全部未执行；批准前不得实施，真实库/模型/浏览器不可用或零断言不得 PASS。本 change 完成也不自动开启生产新候选发布或自治。

## 1. 契约与立即拒绝

- [ ] 1.1 与顺序 00 批准可信 userId/组织/安装/profile 和平台权责；冻结 7 条要求及 ModelPublicDto、ModelSecretWriteDto、ModelCredentialResolver、KnowledgeNamespace、RegistryExecutionEvidencePort、ProductionEvidencePolicy 接口，标清待实现与已有部分。
- [ ] 1.2 在真实 `libs/platform-release` publish/activate、release-automation HTTP/内部/后台入口实施默认生产拒绝与 A2 关闭；缺真实 runner 及必需证据保持关闭，既有稳定确定性业务和独立隔离候选不受误阻断，不把配置/文档声明当部署已关闭。
- [ ] 1.3 对齐 04 的命令结果引用、05/06 的冻结摘要/安装、07 的确认上下文与实时事件、09 的 runner/GateDecision 和10的自治资格；明确冻结候选无需 published 即可评测，不以完整后置验收阻断前段隔离开发。

## 2. 模型公开与内部路径

- [ ] 2.1 将模型默认/列表/详情/mutation/test 及 AI 模块 aiModel 嵌套关系映射为白名单 DTO，阻断 config/baseUrl/上游错误秘密；普通查询不默认加载凭据，不能只在某一个端点删 apiKey。
- [ ] 2.2 修订 `libs/api-client` 公开/仅写类型和 `apps/web-console` 管理表单，app-shared 仅兼容导出；hasApiKey、空输入、省略保留/空白拒绝/显式清除互斥，提交或失败清敏感状态，无秘密缓存/回填。
- [ ] 2.3 为现有明文 key/config 制定受控迁移与存储授权；模型配置仅存引用，先建后切/修订核对/撤销/孤立引用补偿留非敏感账。迁移与回退不可恢复公开 key 或裸明文解析，是否轮换依据真实访问证据而非预设泄露。
- [ ] 2.4 将实际 `AIModulesService` 和 DDD `AIModelService` 内部默认模型消费者、连接测试迁到 ModelCredentialResolver；保留既有 secretRef/identity 架构，不直接将 SSO 任意 env 查值当模型授权。未接线 LLM planner 只冻结未来兼容契约，真实 provider 接线由07负责。

## 3. 知识与技能的窄范围修补

- [ ] 3.1 实现完整 KnowledgeNamespace 和组织/平台技能归属，在 draft 版本分配、publish 替换、rollback 来源与技能注册每个 SELECT/UPDATE/INSERT 加完整谓词；核验部门/用户同组织成员与授权，不虚构现有历史 HTTP API。
- [ ] 3.2 对 global 增独立平台管理权限及可信连接策略，组织 scopeId 规范化；租户只读已发布 global，不可自设 GUC 获管理权；保留已有知识审核/敏感检查/版本绑定功能并核验 rollback 同域来源。
- [ ] 3.3 盘点旧归属/NULL/重复数据并隔离不确定项；新增 CHECK、组织与 NULL 安全版本/单 published 唯一约束、持久命名空间锁及同事务发布/追加回滚来源。保留历史正文，失败不部分 supersede。
- [ ] 3.4 只收紧知识/技能 RLS USING/WITH CHECK 和专项就绪检查；核对知识创建/新增迁移、schema-baseline 与实际迁移入口接线，使用新增迁移不改旧迁移。非绕过生产角色与缺策略必须拒绝专项就绪，不重做已实现 PG jobs/identity/data-scope。

## 4. Registry 事件与会话投影

- [ ] 4.1 复用 `libs/platform-core` 审计写入/追加保护，新增领域 attemptId/seq 生命周期与结果引用，不另建审计哈希链；扩展 agent_tool_calls 投影并将旧无来源 success 标 legacy_unverified，不回填假摘要/权限/结果。
- [ ] 4.2 在 `libs/agent-tools` 全路径持久 received、各类校验拒绝、started/结果事件；复用 digestToolArgs、共享 DataScopeGuard 与既有确认 SQL，将稳定 userId 与显示 actor 分离，可信角色/组由平台解析，direct/MCP/HTTP/会话统一源。
- [ ] 4.3 替换 `AgentSessionsService` 按 trace 工具名生成成功的逻辑；计划/pending 单独存 actionId，事实 trace/SSE/历史仅引用真实结果；执行前证据故障拒绝，执行后故障 outcome_unknown，以命令事实补核而不盲重试写。

## 5. 真实验收与安全回退

- [ ] 5.1 新增离线单元正负拒绝集和场景覆盖表：直接/嵌套 DTO、凭据写入/解析故障、命名空间谓词、每类 Registry 拒绝、pending invoke=0/成功=0、旧记录/未知结果、自报与全部生产入口阻断。专项命令如 `test:ai-trust` 为待新增，不能声称当前已存在。
- [ ] 5.2 在真实 PG 双组织/双实例、非 owner/非 superuser/无 BYPASSRLS 角色下执行部门/个人/global、技能同名、NULL唯一、首次并发、事务中断、global draft SELECT 和 USING/WITH CHECK/迁移就绪拒绝；记录实际数据库/迁移/角色/用例/断言数量，前置失败必须失败。
- [ ] 5.3 在真实 HTTP 身份链与 web-console 浏览器验证无秘密回执/表单、嵌套模型、知识越界、稳定 userId/范围拒绝、direct/MCP 真实事件和证据故障；确认实际结果一致且未确认零执行。若测连接记录真实 provider/model/version/用量，不用规则/mock 冒充模型；完整评测移交09。
- [ ] 5.4 更新实际受影响既有真源 `apps/api/docs/ai-modules-database-and-security.md`、协议和 DOMAIN/AGENT-TOOLS，汇总同 SHA 真实证据与缺项供安全/业务/平台审批；演练只关闭模型/知识/AI执行的安全回退，不恢复泄密/越域/假成功/warn 放行。本次不更新这些真源、不部署、不归档；09/10未真实验收继续禁止生产自治。
