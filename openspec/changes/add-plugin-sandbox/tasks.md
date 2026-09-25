# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **P1** 判据冻结 | 清单协议 + 边界文本 | `openspec validate --strict` 通过；Schema 正例通过、负例（入口越出插件目录 / 未知能力键 / 非 semver 版本）被拒 |
| **P2** 进程边界 | 受限子进程 + 通信协议 | 插件在子进程里读文件 / exec / 起 worker **都被拒**；命令与结果写进协议文本，可复现 |
| **P3** 能力中介 | 声明 → all-of → 审计 | jest：未声明的表/操作/端点逐项被拒；合规调用通过；两类都留痕 |
| **P4** 扫描降级 | 文本正则 → 信号 | jest：命中只写审计不阻断；拼接写法绕过正则时**仍被边界拦住**（证明降级是对的） |
| **P5** 端到端 | 真实插件走 HTTP | e2e：越权插件被拒且留痕；合规插件正常返回；不支持的 `hostApiVersion` 被拒 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 结果），不写"应该可以"。
2. 协议先行：P1 未完成不进 P2/P3。
3. fail-closed：宿主探测不到 `--permission` 支持时**拒绝启动插件**，不静默退回同进程加载。
4. 边界优先于政策：先让能力不存在，再加检查。
5. 每个里程碑结束跑一次全量回归（单元 × 两引擎、e2e、`wasm-modules`、`tsc`）。

### ⚠️ 已知阻塞：整仓单元测试是红的（2026-09-25 实测）

CI 的 `apps` job 跑的是 `npm run test --workspace backend`（**全部** spec，`rootDir: src`）。
实测结果：**20 个套件失败 / 4 个用例失败**：

```text
Test Suites: 20 failed, 33 passed, 53 total
Tests:       4 failed, 394 passed, 398 total
```

失败集中在 `organization-context/`、`auth-context/`、`auth/`、`ai-modules/`、`ai-module-context/`、
`common/events/`，根因是**spec 与实现漂移**：

· 28 处 `Cannot find module '../../../test/utils/test-helpers'`（测试工具模块不存在）
· 大量 `TS2345/TS2554/TS2339`：命令对象形状、方法签名、枚举字面量与实现不一致
· 4 个真实断言失败：`AIModulesService.generateDefinitionStep`（stepId 校验与 CRM 叙事用例）

**与本次改动无关**（插件相关套件在本次已修回绿：7 套件 / 39 用例）。
但它是**落地阻塞**：这条命令红着，任何 PR 都过不了 CI。建议单独立一个 change
（"把既有 spec 修回绿"或"诚实收窄 CI 的测试范围"）—— 不要用"只跑某个子集"来假装绿。

> 纠正一处早先的说法：本会话此前报过"CI 的 apps job 已转强制门禁、全部单元通过"。
> 那个结论建立在**子集测试**上（只跑了 `src/atomic-*` / `src/blueprint` 等），
> 不是 `npm run test --workspace backend` 的真实结果。上面这两行才是。

## Phase P1: 判据冻结

- [ ] `schemas/plugin-manifest.schema.json`：id（kebab-case）/ 版本（semver）/ `hostApiVersion` /
      `entry`（不得越出插件目录）/ `permissions` / `routes`；`additionalProperties: false`
- [ ] `docs/protocols/plugin-sandbox.md`：边界表（**含"出网不被覆盖"**）、能力→声明映射表、
      判据与信号的分工、宿主探测命令与实测结果
- [ ] `plugin-loader.service.ts` 的手写形状校验改为调用协议校验器（一份判定，不两处写）
- [ ] 负例：入口 `../` 越界、未知能力键、非 semver、`hostApiVersion` 不匹配

## Phase P2: 进程边界

- [x] `plugin-host-entry.ts`（子进程侧）：加载插件入口；插件**唯一**的对外出口是
      `callHost(capability, args)`，其余能力都从它长出来（`query` / `mutate` / `callApi` /
      `extendModule` / `log`）。协议用行分隔 JSON，与 `crates/wasm-host` 同形态
- [x] `plugin-host-process.ts`（宿主侧）：探测 → `node --permission --allow-fs-read=<插件真实路径>`
      启动 → 行分隔 JSON 往返 → 超时 SIGKILL 并**立刻**把进程标记为不可用
- [x] 启动前探测 `--permission`；不可用即抛 `PERMISSION_MODEL_UNAVAILABLE`，
      **不退回同进程 require**（Node 二进制可注入，正是为了让这条路径可测）
- [x] 能力请求中转：`authorize`（判定者）→ 拒绝则把"缺哪条声明"回给插件并写审计；
      允许则交给 `executeCapability`（判定权在平台，子进程无权自证）
- [x] 证据：`jest src/plugins/infrastructure/runtime/plugin-host-process.spec.ts` → **11 passed**，
      其中三条越权是在真实子进程里实测：
      `fs.readFileSync('/etc/hosts')` / `child_process.execSync` / `new Worker`
      全部返回 `ERR_ACCESS_DENIED`

> **P2 证据（2026-09-25）**：`node --version` → v24.18.0；`isPermissionModelAvailable()` → true；
> 三条越权实测被拒；合规插件（纯计算 + 走 `context.query`）正常工作；超时 3s → `TIMEOUT`
> 且 `running === false`。
> 两个实现层坑已写进协议文本：① `--allow-fs-read` 必须用**真实路径**
> （macOS `tmpdir` 是符号链接，权限模型按解析后的路径判）；② 一条目录路径即覆盖子目录，
> 不需要通配符。入口脚本用 TS 写（Node 类型剥离可直接跑），同一份源码在 ts-jest 与 dist 都可用。

## Phase P3: 能力中介

- [ ] `plugin-capability-broker.ts`：`context` 的每个方法先过声明校验（复用 `missingPermissions`）
- [ ] 越权 → 抛 `PLUGIN_CAPABILITY_DENIED`，错误里写明"缺哪条声明"（不是"权限不足"）
- [ ] 审计：每次越权与每次成功调用都留痕（`plugin.invoke` / `plugin.capability.denied`）
- [ ] jest：未声明的表 / 操作 / 端点逐项被拒；合规调用通过；空声明插件只能做纯计算

## Phase P4: 扫描降级为信号

- [ ] `plugin-security-validator` 命中改为写审计信号（`plugin.security.signal`），不再阻断
- [ ] 测试证明降级是对的：把模块名拼接起来绕开正则的插件，**仍被 P2 的边界拦住**
- [ ] 协议文本写明：可绕过 / 会误报的检查不该有阻断权（与闸 3 的 S1 同一条原则）

## Phase P5: 端到端

- [ ] e2e：越权插件（尝试读 `/etc/hosts`）经真实 HTTP 调用 → 被拒 + 审计留痕
- [ ] e2e：合规插件（只做纯计算 + 声明范围内的查询）正常返回
- [ ] e2e：`hostApiVersion` 不匹配 → 拒装，错误里说明宿主支持哪个版本
- [ ] 文档：`docs/META_LANGUAGE.md` §3.5 的 Capsule 一节补插件沙箱与原子的**同一套**能力模型
