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

- [x] 2.1 `AgentHostService` + `GET /agent-host/health`；MCP 探测失败返回 healthy=false + fallback=web-sse
- [x] 2.2 `assertMcpToolsSubset`：清单工具必须已注册且 profile 在 allowedAgents 内，否则拒绝启动
- [x] 2.3 `docs/agent-host.md` 沙箱基线 + 部署检查清单
- [x] 2.4 `AGENT_SKILL_ALLOWLIST` + `sha256:<64hex>` digest；注册只建 draft
- [x] 2.5 `agent_turns.tainted/taintSource` + `markTurnTainted`；untrusted 来源拒绝写入知识
- [ ] 2.6 单客户试点：OpenClaw 只开只读工具 + 一个写工具（确认令牌），记录操作审计

## 3. 实例演进闭环（P2）

- [x] 3.1 提议绑定 `platformVersion` 与 `evolutionScope`（entity/DDL/迁移 179440；approve 时 `assertEvolutionBinding` fail-closed）
- [x] 3.2 作者 ≠ 批准人：approve 统一走 `assertApproverDistinct`；作者/智能体自批拒绝（schema + 单测）
- [ ] 3.3 e2e：起草 → 校验 → 预览 → 人批 → 灰度 → 观察 → 回退
- [x] 3.4 拒绝用例：越界 diff/schema 守卫 + 自批 e2e；缺版本绑定由 `assertEvolutionBinding` 单测覆盖

## 4. 回流与分叉护栏（P3）

- [x] 4.1 回流脱敏检查：`redactBackflow/scanBackflow`（客户名/金额/单号/人员/手机/邮箱）+ `POST /releases/backflow/check`
- [x] 4.2 回流路径：`POST /api/builder/proposals/:id/backflow` 生成脱敏平台评审包（requiresManualApproval + next=platform-review）
- [x] 4.3 升级冲突检测：`checkUpgradeConflicts` 三方合并 + `POST /releases/upgrade/conflicts`；冲突返回 path/base/instance/next
- [x] 4.4 e2e：`tests/evolution.e2e.js` 验证冲突阻塞 + 单侧改动自动合并 + 回流包脱敏

## 5. 文档与元语校验（P4）

- [x] 5.1 piagent.md §14.2 宿主边界/降级
- [x] 5.2 agent-evolution.md §15 实例演进范围/绑定/回流
- [x] 5.3 DECISIONS D-14 + AGENT-TOOLS MCP 投影边界（DOMAIN 无新表）
- [x] 5.4 `npm run check:all` 0 error；`openspec validate add-agent-host-and-instance-evolution --strict` 通过
