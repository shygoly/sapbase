# Tasks: 既有运行 AI 链的消费者接线

所有任务均为批准后待实施；本次仅静态复核及 OpenSpec validate，不标记真库/模型/HTTP/browser/部署通过。保留已实现 MCP 桥、参数摘要/TTL/条件消费、数据范围/PG jobs/identity/安装事务，不另列重建任务。一般协议由现有 pending changes 承载，下列只收紧具体遗漏。

## 1. 接口与安全兼容

- [ ] 1.1 联合 01/02/04/06 冻结 credential/已发布检索、可信 identity/会话吊销、真实 Registry event、CommandService 同 EntityManager precondition/claim/result、唯一 ReleaseContext 接口；明确缺项 unavailable，以及 08/09 联调不阻断前段隔离开发。
- [ ] 1.2 冻结 ChatContext/TurnControl/provider 结构化输出、实际 usage/版本能力、每 turn catalog 及 canonical Envelope 契约；同链有效版本与平台隔离 candidateDigest 的 ContextBinding 分权，不能先要求候选 published。
- [ ] 1.3 冻结全 `/api` HTTP/SSE 契约、requestId/turnId/stateRevision/游标、pendingAction 修订及 confirm/invoke 扩 DTO；events/动作 PATCH 明确待新增，兼容 body 与 X-App-Id 冲突拒绝、弱 token 失效、同会话换安装拒绝。
- [ ] 1.4 评审扩展会话/动作/预算/事件存储、保留/脱敏与 RLS 索引；复用 PG jobs 驱动与 lease/事件桥，冻结 Agent 状态 CAS、对账、短租户事务及与 04/06 一致锁序，不把全网络 turn 放进请求事务。

## 2. 实际接线

- [ ] 2.1 在实际 ChatModule 注入 Hybrid 和已注册服务端 provider adapter，复用 01 凭据引用；保留规则零模型调用，固定模型配置/adapter 版本，明确协议/timeout/usage 不可用，关闭/失败不得换 provider 假成功。
- [ ] 2.2 将 identity 稳定 user/org、核验安装及 06 ReleaseContext 接入 AgentSessions；先创建持久 turn.id 再编译 Envelope，回读 route/record/version/allowedActions/可见权限原因；跨安装会话与陈旧执行资格拒绝，统一兼容 chat/message 安全路径。
- [ ] 2.3 接 01 实际版本检索和 PG 必要脱敏历史，保存快照/hash/provenance 并送入模型；禁止自动列满知识引用、latest/NULL 兜底和旧历史冒充当前事实。
- [ ] 2.4 将既有 MCP 投影/桥、selector、Registry 接同一用户/profile/版本子集与平台上下文引用；稳定 userId 传入数据范围，保留 agentInvocable/allowedAgents/all-of 和结构化拒绝；把业务/外部文本限长脱敏包装为数据，不扩大权能。
- [ ] 2.5 扩既有一次性 token 的 user/turn/actionRevision/Release 消费绑定，持久 pendingAction 与服务端可编辑参数修订；canonical 摘要复用，编辑撤旧 token、TTL 不超过动作/turn/现五分钟上限，确认前最新授权。
- [ ] 2.6 以 04 持久 CommandService 替代 Registry writeCache 的执行账本权，授权/范围/版本先于幂等结果；同摘要重连只查原命令，冲突/未知结果不换 key/tool 写；同短事务衔接 token/CAS/命令，无法安全衔接写工具关闭。
- [ ] 2.7 接入持久累计 token 预留/结算、工具认领及绝对 deadline，合成并传播 provider/检索/MCP/Registry/工具与 JobContext 中断；重启/重连/编辑/等待不重置，缺 usage 不填零，批准 wait policy 方可改变默认等待预算。
- [ ] 2.8 注册待新增白名单 Agent turn job handler，入队与 turn 推进同租户事务；复用现有 worker/lease，实施 turn CAS/终态保护/重领前对账与确认释放等待；01 真实事件去重投影，禁止 plan.trace/job 成功推测工具成功。
- [ ] 2.9 将全数组返回改为即时首事件 flush 和执行中持久后 SSE 推送；实现安装/user 授权分页游标、回放订阅对拍/有界背压、同 turn 待确认恢复和取消指定修订，Redis/进程重建后仅 PG 真源，敏感内容过期不可恢复。

## 3. 实际证据与退出

- [ ] 3.1 新增纯契约/实际 Nest DI 负例：provider 畸形/无用量、同 turnId、伪造页面/版本/安装/profile、恶意数据、隐藏工具、改参数旧确认、预算及错误 code；现有会话纯函数测试与 stub Registry MCP 测试只作回归，不冒充端到端。
- [ ] 3.2 在隔离真实 PG/RLS 多实例执行跨 user/turn/action/安装/Release、过期及并发 token 消费、撤权/吊销后幂等结果拒绝、同 key 异摘要、取消与 commit/claim 故障对账；断言实际业务写数/真实 eventId，而非 mock repository。
- [ ] 3.3 在真实 PG/Redis 验证 worker lease 重领、应用/进程重建、Redis 丢失、待确认原 turn 恢复、网络工作无长 DB 事务、首 SSE 先于阻塞完成、游标/慢客户端及迟到完成不可覆盖，后续调用/预算不重置。
- [ ] 3.4 每个拟启用 provider 运行真实自然语言/上下文指代/实际引用/超时预算/恶意文本；联合 08 browser 验证编辑重确认、版本切换、取消重连和真实结果回读，输出同 SHA/provider requestId/adapter/版本/usage 证据供 09 同 candidateDigest 评测。
- [ ] 3.5 实施后登记待新增 @sap/api test:runtime-ai-contract/test:runtime-ai-e2e 并接 03 严格 CI 与现有 test-evidence；同步既有 piagent/chat 协议、DOMAIN/AGENT-TOOLS/必要共享 schema 与真实实体契约，由 owner 更新权威真源。汇总真实 suite/case/断言及失败/skipped/unavailable，经业务/安全/平台批准隔离验收；缺真实证据不 PASS，09 前不开放生产新发布/A1/A2，10 前不开放 A2。
