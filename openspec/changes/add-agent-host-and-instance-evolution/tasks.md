# Tasks

> 依赖：`refactor-ai-native-business-app-platform` 的 `agent-runtime`（会话/运行/工具调用/预算/审计）。
> 在该变更合并前，只实现 P0 的投影部分与 P2 的蓝图侧校验。

## 1. 工具面 MCP 投影（P0）

- [x] 1.1 确认投影所需字段：现有契约已齐备（name / description / parameters / write / confirmation /
      timeoutMs / untrustedResult / sensitiveArgs / allowedAgents），**不新增字段**；规则见 design Decision 2
- [x] 1.2 新增 MCP 投影器：`scripts/meta/lib/mcp-projection.mjs` + `project-mcp-tools.mjs`，
      由契约生成 `contracts/mcp-tools.json`，不手写第二份
- [x] 1.3 扩展 `scripts/meta/check-agent-tools.mjs`：契约 ↔ MCP 清单 ↔ `AGENT-TOOLS.md` 三方对拍
- [x] 1.4 内嵌通道经 MCP 客户端调用同一工具面：`AgentToolMcpBridge`，
      `AGENT_TOOL_TRANSPORT=mcp` 时走 MCP、默认 `direct` 保持行为等价；
      租户/权限/确认令牌按引用传递（`_meta.contextId`），模型参数无法伪造；profile 收窄在 listTools 生效
- [x] 1.5 拒绝路径单测已存在并复跑通过：未知工具、参数非法、权限不足、缺确认令牌
      （`apps/api/src/agent-tools/agent-tool.registry.spec.ts`）

## 2. 宿主接入（P1）

- [ ] 2.1 宿主适配层：进程生命周期、健康检查、不可用时降级到 Web SSE
- [ ] 2.2 双 profile 工具收窄：宿主侧 allowlist MUST 是网关授权集的子集
- [ ] 2.3 沙箱基线：非 root、无通用 shell、网络仅回环 MCP 端口
- [ ] 2.4 skills 白名单 + 签名校验 + 禁止运行时自动安装
- [ ] 2.5 untrusted 标记与 turn taint 写入会话存储；知识写入前校验来源
- [ ] 2.6 单客户试点：OpenClaw 只开只读工具 + 一个写工具（确认令牌），记录操作审计

## 3. 实例演进闭环（P2）

- [x] 3.1 提议绑定 `platformVersion` 与 `evolutionScope`（entity/DDL/迁移 179440；approve 时 `assertEvolutionBinding` fail-closed）
- [x] 3.2 作者 ≠ 批准人：approve 统一走 `assertApproverDistinct`；作者/智能体自批拒绝（schema + 单测）
- [ ] 3.3 e2e：起草 → 校验 → 预览 → 人批 → 灰度 → 观察 → 回退
- [ ] 3.4 拒绝用例：越界变更（改表/改工具契约）、缺版本绑定、自批

## 4. 回流与分叉护栏（P3）

- [ ] 4.1 回流脱敏检查：客户名称、金额、单据号、人员信息
- [ ] 4.2 回流路径：实例提议 → 平台评审 → 模板/规则包 → 平台版本
- [ ] 4.3 升级冲突检测：结构化 diff + 可执行差异清单，冲突时阻塞升级
- [ ] 4.4 e2e：冲突阻塞升级；无冲突升级后实例改动保留

## 5. 文档与元语校验（P4）

- [ ] 5.1 `docs/protocols/piagent.md` 增补宿主层边界与降级语义
- [ ] 5.2 `docs/protocols/agent-evolution.md` 增补实例演进范围与回流
- [ ] 5.3 `DOMAIN.md` / `AGENT-TOOLS.md` / `DECISIONS.md` 同步（新增决策需登记 `D-x`）
- [ ] 5.4 `node scripts/meta/check-all.mjs` 0 error；`openspec validate --strict` 通过
