# Change: Add Output Gate and Shadow Release

## Why

「零能力执行」这条线目前**只补了一半**。已经就位的：

```text
闸 0 源码预检 ✅   编译之前挡住危险的构建脚本
闸 1 静态白名单 ✅ 不运行就挡住非白名单导入 / start 段 / 共享内存 / 表
闸 2 复现构建   ✅ 两个独立构建器，哈希不一致就不收
闸 5 吊销       ✅ 执行前查名单
─────────────────────────────────
闸 3 输出管控   ❌ 空   ← 唯一剩下的"运行期"缺口
闸 4 影子发布   ❌ 空   ← 唯一剩下的"发布流程"缺口
```

缺闸 3 的后果很具体：一个原子**不读任何东西**，所以它不能"偷数据出去"——
但它仍然可以把**编在代码里的常量**当成计算结果交出来（例如把一段密钥藏在某个输出列的高位上，
或让输出取决于行数 / 行序，从而给自己开一条隐蔽信道）。现在的执行链只检查
"输出字节数 ≤ 声明上限"与"列形状对得上"，对**值**本身没有任何判据。

缺闸 4 的后果同样具体：准入状态机里 `shadow` / `canary` 两个状态**存在但没有闸**——
模块可以凭一次 `bindImplementation(status: 'active')` 直接进生产，`Tested → Shadow → Canary → Active`
只是文档里的图，不是平台在拦。

两者都不是"再加一个检查"的问题，而是**先把判据写进协议**：判什么、不判什么、
信号还是判决。否则实现出来的是一批让人关掉的检查（本仓库已经踩过一次，见
`add-blueprint-package-and-compiler/design.md` 的"为什么不对实体关系图做环检测"）。

## What Changes

- **ADDED**: `docs/protocols/atomic-output-audit.md` —— 闸 3 的判据文本（结构封闭 / 值域 / 批量-单条一致 /
  置换不变 / 常量位信号），并**明确列出不判什么**（不判"输出是否好看"、不做统计显著性检验）
- **MODIFIED**: `schemas/atomic-contract.schema.json` —— 输出契约补齐可判据的声明：`commutative`（声明后置换不变性可判）
  与输出行可交换性 `commutative`；逐列值域**复用既有的 `minimum` / `maximum`**（不另造 `range` 这种同义词）
- **ADDED**: `backend/src/atomic-runtime/output-gate.ts` —— 闸 3 实现：四条判决 + 一条信号，全部**确定性**
- **ADDED**: `backend/src/atomic-runtime/shadow-release.ts` —— 闸 4：`Tested → Shadow → Canary → Active` 的编排与证据门，
  缺证据即拒；`bindImplementation` 不得绕过它
- **ADDED**: 一个**故意要泄漏**的样例模块（`wasm-modules/modules/leaky-*`）：把常量塞进输出高位 + 让输出依赖行序，
  用来证明闸 3 真的挡得住（而不是"看起来挡得住"）
- **MODIFIED**: 原子执行链：闸 3 在执行后运行；命中判决则拒绝返回结果并审计留痕（**不返回**、不是"警告后放行"）
- **ADDED**: e2e —— 泄漏模块被闸 3 拦下；合规模块走完影子发布被晋升；绕过晋升直接 active 被拒

**前置（P0，阻塞修复）**：`module-registry` 的查询与 `addCapability` 等既有接口在真实库上直接报错
（`column ... role does not exist`）。根因已核实：**仓库迁移集里没有任何迁移创建 `users` 表**
（`rg "name: 'users'" src/migrations/` 无结果），它是按增量叠在早期库上的。

量化之后，"从零重建"比这条缺口大得多：**30 张实体表里有 15 张没有任何迁移创建**

```text
ai_models, ai_module_reviews, ai_module_tests, ai_modules, audit_logs, departments,
menu_items, module_capabilities, module_configurations, module_registry,
module_relationships, module_statistics, roles, users, workflow_auto_suggestion_logs
```

因此 P0 分两步做：先补 `users` 基线（空库建表 / 旧库补列，幂等且只做加法）让受影响的既有接口
e2e 跑起来；再把**"完整从零重建"做完** —— squash 基线（从实体定义生成）+ 重建脚本 + 验证器，
判据是"TypeORM 的 schema diff 里没有结构差异"，而不是"数出 30 张表"。
实测还否掉了一条看起来更自然的路（基线 + 回放历史迁移），原因见 `tasks.md` 的 P0 记录。

## Impact

- 受影响规格：`atomic-runtime`（新增闸 3 / 闸 4 两组要求）、`atomic-registry`（输出契约与状态机门）
- 受影响代码：`backend/src/atomic-runtime/`（执行链、审计）、`backend/src/atomic-registry/`（绑定路径）、
  `wasm-modules/`（新增泄漏样例与其构建）、`schemas/atomic-contract.schema.json`、`backend/src/migrations/`
- **向后兼容**：`outputAudit` / `commutative` 都是**可选**声明。未声明的原子只跑"结构封闭 + 值域上限 + 批量-单条一致"
  这三条不需要额外声明的判据；置换不变性在未声明时**不判**，并在审计里写明"未判"（而不是默认通过）
- 风险：闸 3 会对**已在跑**的原子生效。带 `atomic-cpu-budget` 的既有契约不受影响（默认引擎不变），
  但若某个既有原子的输出含有与输入无关的常量，它会从 active 变为"被拦下"——这正是想要的行为，
  但仍需在 tasks.md 里给出按契约逐个过一遍的步骤与清单

## Decisions Made

1. **判据先写进协议，再写实现**（元语不变量 10）。闸 3 的判据文本先进 `docs/protocols/`，
   实现只做文本里的判定，不自行加码。
2. **判决与信号分开**。四条是判决（命中即拒绝执行结果）；"常量位模式"是**信号**——
   它只写审计、不拒绝。理由是它无法排除误报（一个合法的"边界值裁剪"原子可能真有常量输出），
   而"让人关掉的检查"比"没有检查"更糟。
3. **不做统计显著性检验、不做抽样**。四到五个泄漏样本跑不出可信的统计结论，只会得到随机的红绿。
   全部判据都是**确定性**的：同样的输入必须得到同样的结论。
4. **闸 4 的证据门用已有资产**：`sourceGate` / `staticGate` / `reproducibleBuildRef` / `review` 都已在实现里，
   闸 4 不新造证据格式，只规定"晋升到下一状态前必须有哪些证据"。
5. **不经闸 4 不得 active**：`bindImplementation` 接受 `status: 'active'` 时必须能指出完整的晋升链，
   否则拒绝——这是把状态机从"文档里的图"变成"平台在拦"的唯一方式。

## Out of Scope

- **插件沙箱化**（`backend/src/plugins`）：把插件也做成零能力执行是同一方向的下一步，
  但它需要先定插件的 ABI（不是原子 ABI），本变更不动
- **License / Capsule / 签名**（协议 5）：闸 4 会用 `review.confidential` 这类既有字段，
  但不实现加密与授权绑定
- **图 / 向量检索、事件溯源、可观测性栈**：与"零能力执行"无关的其他空白
- **闸 3 的"反隐蔽信道"完整形式**（信息论意义上的信道容量上界）：v1 只做上面四条确定性判据
