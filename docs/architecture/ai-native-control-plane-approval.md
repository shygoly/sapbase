# AI-Native 控制面架构批准包（待签字）

> 状态：**DRAFT / PENDING OWNER SIGN-OFF**。本文件不是批准本身；未签字前
> 不启动 01–10 的生产实现，不放行新生产发布或 A2 自治。
>
> 对应 change：`refactor-ai-native-control-plane-boundaries`（00）
> 基线：`ce1e538dcec6539f66bba80d5413a3b6741486c9`（weichen 分支）
> 真源：`openspec/changes/refactor-ai-native-control-plane-boundaries/design.md`

## 1. 七条契约与验收判据

| # | 契约 | 验收判据 | 下游 owner |
|---|---|---|---|
| C1 | 确定性业务 Kernel 与模型 Host 分离 | 业务事实/规则/授权/提交不依赖模型；Host 只能经 Registry 与受控端口 | 01/04/07 |
| C2 | 可信四角色能力来源 | Runtime Operator / Builder / HumanApprover / ReleasePolicyService 均由平台身份/安装解析；`body.role`、caller passed、URL 不成为事实 | 01/02/06/07/10 |
| C3 | Registry 最小 DI 与唯一业务接缝 | Registry 只持有提议/候选窄端口；禁止注入完整 ReleasesService/业务仓储；direct 与 MCP 同一判定 | 01/04/05/09 |
| C4 | 冻结候选、真实证据、有效版本 | 固定顺序 `candidateDigest → 真实测试/评测 → 可信审批 → 签名未公开工件 → GateDecision → published → activation`；无环 | 03/05/06/09 |
| C5 | 保留主体栈与 PG 持久真源 | Next/Nest/TypeORM/PG/RLS 保留；Redis 可丢；单生产引擎；显式 memory/Redis 不静默 | 03 |
| C6 | WASM 单生产引擎与失败策略 | 部署单元预选一个获准引擎；未知引擎值拒绝；引擎级故障才显式 fallback，module trap/fuel/timeout 不换引擎 | 03/04 |
| C7 | 实例演进与外围源码分离 | 实例只改 Blueprint/Delta；源码 Agent 只在外围仓库提 PR；deploy ≠ publish ≠ activate | 06/10 |

## 2. 逻辑依赖矩阵（DI 冻结）

| 消费者 | 允许 | 禁止 |
|---|---|---|
| `shared-schemas` / `shared-core` / `release-kernel` | 类型、Schema、金额/规范化、纯发布判据 | 模型 SDK、业务仓储、Nest 服务、网络/文件 IO |
| `agent-kernel` | 上下文/预算/工具协议、抽象端口 | platform/domain 实现、Repository、provider IO |
| `semantic-runtime` 等确定性业务用例 | 规则、权限、数据范围、应用事务/仓储端口 | 模型/Host/Jev 依赖、模型授权结论 |
| Host（`chat` / `agent-sessions`） | 模型适配端口、ContextEnvelope、Registry/MCP、会话持久化 | 业务 Repository、批准/签名/publish/activate、任意 SQL/shell |
| `agent-tools` Registry | 最小查询/命令、提议/候选窄端口、审计/确认/范围端口 | 完整 ReleasesService、发布密钥、复制业务规则 |
| 发布/激活控制面 | release-kernel、可信身份、候选/证据、审批、签名、安装事务 | caller passed/role/URL/Agent trace 补齐事实 |
| `apps/api` 组合根 | 绑定明确 adapter、能力受限门面 | 把完整 Repository/发布服务当端口传入 Host/Registry |
| Portal/Console/UI 库 | 平台 HTTP/SSE、冻结 UI、版本上下文 | provider/PG/签名/部署密钥、客户端权威授权 |

## 3. 端口所有权（拟冻结）

| 端口 | 唯一生产者 → 消费者 | 拒绝语义 | owner |
|---|---|---|---|
| 可信主体/安装上下文 | 身份/安装 → REST、Host、Registry、控制面 | 缺失/跨范围 DENIED；runtimeProfile ≠ agentProfile | 02/06/07/10 |
| 有效 ReleaseContext | 安装/激活 → 命令、UI、Host | URL/packageId/latest 只是提示 | 06 |
| 模型适配 | provider → Host IntentParser | TIMEOUT/UNAVAILABLE 不产生提交事实 | 07（凭据 01） |
| 工具结果/事件 | Registry → Host、审计、评测 | 待确认不得产生 success | 01（业务 04） |
| 冻结候选 | 草稿/Delta → runner、预览、审批、签名 | 变更即新 candidateDigest，旧证据/批准失效 | 05 |
| 真实证据 | CI/Registry/runner → 门禁 | missing/unavailable/skipped ≠ passed | 03/09 |
| 最终 GateDecision | 09 → 05 publish、06 activation、10 资格 | 提交前重新核验同摘要 | 09 |

## 4. 技术栈锁定快照

| 项 | 锁定/事实 | 处置 |
|---|---|---|
| Next/React/Nest/TS | Next 15.5.12、React 18.3.1、Nest 10.4.22 | 保留；升级独立批准 |
| PG/TypeORM | TypeORM 0.3.28、CI PG16 | 保留；生产版本需部署证据 |
| npm/Nx | 根唯一 npm 锁；apps/libs/wasm-modules | 保留；CI 严格接线归 03 |
| 缓存 | cache-manager 7.2.8 + 旧 redis-store 3.0.1 | 03 收敛 Keyv/显式 memory；不静默 |
| 持久真源 | PG：对象/安装/审批/幂等/证据 | Redis 只加速，不决定授权/成功 |
| Rust/WASM | Rust 1.95.0、Wasmtime 48.0.3 | 保留；单生产引擎 |
| 部署 | portal/console/API 模块化单体 | 不要求微服务/K8s/客户 fork |

## 5. 签字表

| 角色 | 姓名 | 结论（批准/有条件批准/拒绝） | 条件 | 日期 |
|---|---|---|---|---|
| 架构负责人 |  |  |  |  |
| 安全负责人 |  |  |  |  |
| API/平台 owner |  |  |  |  |
| Release/Agent owner |  |  |  |  |
| 产品 owner（A1/A2 边界） |  |  |  |  |

**签字前必须确认：**

- [ ] C1–C7 无修改，或修改已回写 design.md 并重新 strict validate。
- [ ] 下游 01–10 的 owner/接口版本/拒绝集已确认。
- [ ] 生产新发布在 09 真实验收前保持关闭；A2 在 10 全部依赖批准前关闭。
- [ ] 真实模型/真库/浏览器/宿主/评测环境缺失时，只允许隔离夹具开发，不得标生产验收。
- [ ] 回退不恢复 `body.role`、无审批 publish、URL 包旁路、自动引擎切换。

## 6. 下游启动顺序（签字后）

1. **B1 并行**：01 + 02 + 03
2. **B2**：04 + 05（依赖 01/03 接口）
3. **B3**：06（依赖 04/05）
4. **B4 并行**：07 + 08（依赖 01/02/04/06）
5. **B5**：09（依赖 03/04/05/07）
6. **B6**：10（依赖 09 真实评测与批准）

## 7. 当前明确未验收

- 未运行真实模型循环、真实 PG/Redis 多实例、浏览器、外部 Host 部署。
- 未证明同进程 Node 被攻陷后的隔离；凭据/源码构建是独立执行边界。
- 未证明生产 Wasmtime readiness；CI 上传工件不等于部署验证。
- 未完成真实候选评测/审批/签名/激活联合验收。

在上述证据齐备前，本批准包只能支持**隔离开发与夹具验证**，不能作为生产自治或 A2 放行依据。
