# Change: Add Plugin Sandbox

## Why

插件系统已经有完整的骨架：领域实体（`Plugin` / `PluginPermissions`）、加载器、生命周期、
API 路由、审计与事件。但它的**安全边界是假的**，具体到三处：

```text
① 加载方式      plugin-runtime.service.ts 用 require/import 把插件装进 API 进程
                → 插件与宿主同权限：能读任意文件、能 exec、能直接出网
② "安全校验"    plugin-security-validator.service.ts 是**源码文本正则**
                （/require\s*\(\s*['"]child_process['"]/ 之类）
                → require('child_' + 'process')、import()、process.binding 都能绕
③ 权限声明      manifest 声明 api/database/ui/modules 权限，运行时**不强制**
                → 声明是"意向书"，不是"能力清单"；未声明也不影响它真去做
```

于是当前状态可以一句话概括：**声明是政策，执行是裸奔**。这与原子那条线形成了刺眼的对比 ——
原子是零能力沙箱 + 声明式契约 + 全量审计，插件则是同进程 + 文本正则 + 声明不落地。

本变更把插件拉到与原子**同一套能力模型**：能力必须声明，声明之外**根本不存在**，
每一次越权都在平台侧被拒并留痕。

## What Changes

- **ADDED**: `schemas/plugin-manifest.schema.json` —— 插件清单协议（唯一权威）：
  id/版本/入口/host API 版本/能力声明/是否请求特权，取代 `plugin-loader.service.ts` 里手写的形状校验
- **ADDED**: `docs/protocols/plugin-sandbox.md` —— 边界与判据文本（判什么、拿什么保证、**不保证什么**）
- **ADDED**: 子进程执行边界 `backend/src/plugins/infrastructure/runtime/plugin-host-process.ts`：
  插件在 `node --permission` 子进程里运行，**禁止文件读写、子进程、worker**
- **ADDED**: 能力中介（`plugin-capability-broker`）：插件要做的每件事都得走宿主 API；
  宿主按清单逐项做 all-of 校验（复用原子的 `missingPermissions`，不另写一份）
- **MODIFIED**: 文本正则从"安全判决"降级为**信号**（写审计、供审查），
  因为它可被绕过 —— 一条能被绕过的检查如果被当成判决，比没有更危险
- **ADDED**: e2e —— 试图读文件 / exec / 起 worker 的插件**被边界拦住**；
  未声明能力的调用被拒；合规插件正常工作；两种结果都留痕

## Impact

- 受影响规格：`plugin-system`（新增进程隔离、能力声明与中介、审计三组要求）
- 受影响代码：`backend/src/plugins/infrastructure/{runtime,security,services}/`、
  `backend/src/plugins/plugins.controller.ts`、`schemas/`、`shared-schemas`
- **破坏性变更（对内）**：插件的加载方式从"同进程 require"改为"宿主进程 + 子进程 RPC"。
  既有插件若直接 `require('fs')` 会**立刻失败** —— 这正是本变更的目的，
  但必须在 tasks.md 里给出存量插件的迁移步骤与清单
- 风险：`--permission` 是 Node 的权限模型（本机 Node 24 实测可用），
  但它**不覆盖出网**（见下）—— 因此本变更不声称"插件无法外泄数据"，
  只声称"文件/子进程/worker 三条路被关死，且越权会被拒并留痕"

## Decisions Made

1. **边界优先于政策**。先做"拿不到"（能力不存在），再做"不许用"（校验）。顺序反了就会
   得到一堆看起来安全、实际可绕的检查。
2. **复用原子的能力模型，不另起一套**：声明 → all-of 校验 → 审计 → fail-closed。
   `missingPermissions` 只写一份（元语不变量 12）。
3. **静态文本扫描降级为信号**。理由与闸 3 的 S1 同源：判据必须能说清"违反了哪条声明"，
   而"源码里出现了某个字符串"说不清 —— 它既会误报（注释里写了 `require('fs')`），
   也会漏报（拼接出来的模块名）。它仍然有用，但只在审计里当线索。
4. **明确写下不保证什么**：Node 的权限模型不覆盖网络。要么部署层给网络策略，
   要么接受"插件能出网"这个事实并据此限定插件来源（只允许 Tier A 平台自研）。
   **不写这条就是把风险留给读文档的人去猜**。

## Out of Scope

- **插件的 Wasm 化**（把插件也做成零能力 ABI）：那是插件 ABI 的另一次协议冻结，本变更不做
- **插件市场与签名**（License / Capsule）：属协议 5 那条线
- **UI 插件（前端侧）的隔离**：前端插件跑在浏览器沙箱里，风险模型不同，另立变更
- **出网的 OS 级控制**（网络命名空间 / 容器网络策略）：本变更只如实标注它的缺失
