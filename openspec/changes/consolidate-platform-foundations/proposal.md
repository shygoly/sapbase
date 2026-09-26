# Change: Consolidate Platform Foundations

## Why

平台现在有**四处分叉**，每一处都会让后续每个新组件多选一次边。实测：

```text
① 状态机三套并行（约 11,000 行）
   backend/src/workflows/          1887 行  ✅ 已装配  ❌ 零 spec
   backend/src/workflow-context/   2896 行  ❌ 未装配  ✅ 有 spec
   backend/src/semantic-runtime/   6220 行  ✅ 装配 + spec + e2e（蓝图驱动 record-transition）

② 交互两套并存
   35 个固定页面（含 admin/workflows 那套 5 组件 + 211 行 API 客户端）
   vs add-chat-first-erp 的 Interaction Plan（协议已冻结，前端未做）

③ 定义来源两条
   ai-modules 真调模型产出"模块定义"（ai_module_definitions 六步 + mergedDefinition）
   vs Blueprint 五层（semantic / flows / rules / experience / license）
   —— AI 产物目前**不是**蓝图包，进不了编译/交付链

④ 能力出口半闭环
   审批链已真的执行（P2）：单据会进待审、有读链与 approve 端点
   但：没有待办（按审批人聚合）、没有通知（审批人不知道）→ **待审存在，没人被告知**
   通知服务存在，却存在内存 Map 里、且**零业务生产者**
```

四处都不是"缺功能"，而是**已有资产没有收敛**：多做一件事就要多选一次边。

## What Changes

### W 工作流收敛（唯一状态机 = `semantic-runtime`）

- **保留**：`semantic-runtime` 的蓝图驱动状态机（`record-transition.ts`：乐观锁 + 审计 + 蓝图校验）
- **保留能力，换掉实现**：`workflows` 里用户可见的能力搬到蓝图接口上 ——
  定义（= `flows.json`，编译期已校验）、实例（= `blueprint_records`）、
  迁移（= record-transition）、历史（= 迁移审计 + 历史读回）、AI 建议迁移（保留，见 A）
- **前端**：`admin/workflows` 那套改为调用蓝图接口；随后由 chat-first 的交互面取代
- **退场**：`workflows` 与 `workflow-context` 两棵树标记 deprecated → 先停用、再删除
- **数据**：`workflow_definitions / workflow_instances / workflow_history` 的存量数据给出迁移或归档路径（不静默丢弃）

**为什么是 semantic-runtime 那套（技术论据，不是偏好）**：
`workflows` 需要 `EntityStateUpdaterRegistry` 这个**桥**才能把状态写回业务实体
（实体状态在别处、流程状态在这里，两边要对账）；
而蓝图驱动的记录**本身就是蓝图实例** —— 状态字段与流程状态是同一份数据的两个视角，
桥不存在，也就不会漂移。

### N 通知与待办（Outbox 先行）

- **Outbox 先行**：进程内 `EventBus` → 持久化 outbox 表 + 投递器
  （**不**先做通知：跨进程/重启不丢是所有下游的前置）
- **通知持久化**：`notifications` 表（替换内存 Map）；已读状态持久
- **有生产者**：审批待审（P2 已产出 pending 链）、单据状态变化、导入完成/失败
- **待办（inbox）**：按审批人聚合"有哪些单在等我批" —— 现在只有"给我一张单我读它的链"
- **可选**：超时提醒（等太久推一次）

### A AI 输出收敛成蓝图五层

- **转换器**：`ai_module_definitions.mergedDefinition` → 蓝图五层
  （semantic / flows / rules / experience；license 由交付时生成）
- **产出即制品**：AI 生成结果直接落成蓝图包 → 能被编译（IR）→ 能被装载 → 能被签名交付
- **判据**：AI 生成的东西进得了既有的编译/交付链，而不是停在 `ai_module_definitions` 表里

### X 交互以 chat-first 为主（由既有 change 承担）

本变更**不重复** `add-chat-first-erp`（协议已冻结，C2–C5 待做），只在决策上确认：
`core/page-model` 与 Patch DSL **降级**为"plan 的一个 block 类型 / 后台编辑工具"，
不再是主线；退出主线**不等于**立即删除（向后兼容）。

## Impact

- 受影响规格：新增 `notification-outbox`、`workflow-consolidation`；
  `semantic-runtime` 为 MODIFIED（承接原 `workflows` 的用户可见能力）；
  `ai-module-management` 为 MODIFIED（AI 产出改为蓝图五层）
- 受影响代码：`backend/src/workflows/`（退场）、`backend/src/workflow-context/`（退场）、
  `backend/src/semantic-runtime/`（承接）、`backend/src/websocket/services/notification.service.ts`（重写为持久化）、
  新增 `backend/src/outbox/`、`backend/src/ai-modules/`（转换器）、
  `speckit/src/app/[locale]/admin/workflows/`（改接口 → 逐步退场）
- **不放松任何既有闸**：收敛只搬能力，不改判据；通知/待办复用既有权限与审计
- 风险：**前端在用的能力不能先拆**。对策：先"双跑"（新接口与旧接口同时可用）→ 前端切过去 → 再删旧实现

## Decisions Made

1. **状态机只留一套：`semantic-runtime` 的蓝图驱动**。理由不是"我们的更新"，
   而是它**不需要桥**（记录即实例），而桥正是漂移的来源。
2. **先 Outbox，后通知**。通知存内存 Map 是"看起来有"的典型；没有持久化事件，
   跨进程与重启不丢都做不到，通知、追溯、对账全都要返工。
3. **AI 不新定义协议**：`mergedDefinition` 只做**转换**，产出必须落进既有五层。
   这样 AI 产物与人工模板走同一条编译/交付链（一条链，不是两条）。
4. **收敛分两步：先双跑、再删**。前端在用旧接口，直接删等于把用户界面打断。
5. **本变更不做**（我对 C 档其余项的决策，见 `design.md` §4 的决策表）：
   报表/看板、单据输出（PDF/Excel）、出站集成、数据范围、可观测性栈、部署形态、
   多币种汇率/时区、市场结算、搜索/图/向量、移动端。每项都写明**触发条件**，
   而不是"以后再说"。

## Out of Scope

- `add-chat-first-erp` 的实施（C2–C5）：本变更只确认交互主线，不重复它的工作
- 报表引擎与打印模板：触发条件是"第一个真实客户上线"
- 数据范围（部门/仓库级）：取决于可信的用户属性模型，宁可不做也不从请求参数取
- 删除历史数据：本变更只提供**导出与归档**路径，不物理删除既有数据
