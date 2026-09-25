# Change: Restore Green Backend Tests

## Why

CI 的 `apps` job 跑的是 `npm run test --workspace backend`（**全部** spec，`rootDir: src`）。
实测（2026-09-25，本仓库当前状态）：

```text
Test Suites: 19 failed, 34 passed, 53 total
Tests:       4 failed, 396 passed, 400 total
```

这不是"几个用例要调"，而是**主干不可信**：任何 PR 都过不了 CI，于是所有已完成的协议与实现
（原子运行时、Blueprint 编译/加载、插件沙箱）都停在分支上。而且因为早先只用**子集**
（`src/atomic-*` / `src/blueprint` …）做验证，红灯被掩盖了相当一段时间 ——
这件事本身就是这条 change 存在的理由：**绿灯必须是可复现的，而不是被选出来的**。

失败集中在六个领域：`organization-context`、`auth-context`、`auth`、`ai-modules`、
`ai-module-context`、`common/events`。首批根因已修（spec 里 `test/utils` 的相对路径少一层，
见 commit `a7c5743`：28 处 `TS2307`）。剩下的是 spec 与实现的**形状漂移**：

```text
TS2345 参数类型不匹配（命令对象/聚合输入形状变了）  84 处
TS2554 参数个数不对（工厂/构造签名变了）            60 处
TS2339 属性/方法不存在                              52 处
TS2551 方法名变更                                   16 处
0 处：还有 4 个真实断言失败（ai-modules 的 generateDefinitionStep）
```

## What Changes

- **修复**：按领域逐块把 spec 对齐到**当前实现**的真实契约（命令对象形状、方法签名、枚举）
- **补回**：缺失的测试工具（`backend/test/utils/*` 已存在，路径与用法一并核实）
- **删除（如确有必要）**：只允许删"被测行为已被移除"的用例，且必须在 `tasks.md` 里
  逐条列出删了什么、为什么 —— 不允许靠删测试凑绿
- **MODIFIED**: CI 的 `apps` job 在 `tasks.md` 记录实测证据；若确有范围收窄，
  必须在 `.github/workflows/ci.yml` 与文档里写明**收窄了什么、为什么**

## Impact

- 受影响：`backend/src/**/*.spec.ts`（六个域）、`backend/test/utils/*`、可能涉及少量
  `backend/src/**` 中"spec 是对的、实现是错的"之处（这类要单独判定，见下）
- **不属于本变更**：`backend/test/*.e2e-spec.ts` 里的历史 e2e（`auth` / `roles` / `departments`
  / `users` / `plugins` / `ai-module-lifecycle`）—— 它们需要真实库与完整 AppModule，
  现状是**跑起来会挂住**（早先实测：整目录 e2e 十分钟不返回）。本变更只在 tasks 里
  记录这个事实与建议，不动它们
- 风险：修 spec 时容易"顺手改实现"来让断言通过。判定原则写在 decisions 里

## Decisions Made

1. **判别谁是错的**：spec 与实现不一致时，默认按"实现是当前意图、spec 是历史快照"处理，
   但**必须逐处确认**：若 spec 断言的行为在实现里被静默删除（而不是有意变更），
   那是实现的问题，要在 tasks 里单列出来，而不是把 spec 改掉。
2. **不用 jest `moduleNameMapper` 模糊匹配来"修"导入错误**：那会把写错的导入藏起来。
   路径写对是一眼能看出真假的事实。
3. **不靠删除凑绿**：允许删除，但删除必须有理由且写在案。
4. **每个域修完就跑一次整仓 + 附证据**：分域的中间态允许是红的，但每一步的**方向**必须可验证。

## Out of Scope

- 重写这些领域的测试策略（是否该用 Testcontainers、是否该拆集成/单元）
- 历史 e2e（`test/*.e2e-spec.ts`）的修复：它们要么需要真实库、要么会挂住，另立变更
- 覆盖率阈值：现配置有 70/80/85 的阈值，本变更**不调整**它
