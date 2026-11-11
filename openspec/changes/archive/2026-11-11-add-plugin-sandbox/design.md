# Design: 插件沙箱与能力中介

## 现状审计（先摆事实，再谈方案）

| 维度 | 现状 | 判定 |
| --- | --- | --- |
| 加载方式 | `plugin-runtime.service.ts` 在 API 进程内 `require` / `import` 插件入口 | ❌ 与宿主同权限 |
| 安全校验 | `plugin-security-validator.service.ts`：源码正则扫 `require('child_process')` 等 | ❌ 可绕（拼接、`import()`、`process.binding`、`eval`） |
| 权限声明 | `PluginPermissions.fromManifest()` 解析 api/database/ui/modules | 🟡 声明齐备但**运行时不强制** |
| 审计 | `plugin-audit-logger.service.ts` 存在 | 🟡 有出口，缺"越权被拒"的留痕 |
| 生命周期 | activate/deactivate + 事件 + 依赖解析 | ✅ 与本变更无关，保留 |

结论：**声明是政策，执行是裸奔**。要补的不是"再加一条检查"，而是"让声明之外的能力不存在"。

---

## 一、边界：插件跑在受限子进程里

插件在 `node --permission` 子进程里执行。本机 Node 24 实测（写在协议文本里，可复现）：

| 能力 | `--permission` 下 | 说明 |
| --- | --- | --- |
| 读文件（allowlist 外） | ❌ `ERR_ACCESS_DENIED` | 实测 |
| 写文件（allowlist 外） | ❌ `ERR_ACCESS_DENIED` | 实测 |
| `child_process` | ❌ `ERR_ACCESS_DENIED` | 实测 |
| `worker_threads` | ❌ `ERR_ACCESS_DENIED` | 实测 |
| **出网（`net.connect`）** | ✅ **仍可** | ⚠️ Node 权限模型不覆盖网络 |

最后一行是本变更**必须写在明面上**的边界。平台能保证的是前四行；
网络要么由部署层给策略，要么接受"插件能出网"并据此限定来源。

### 进程模型

```text
API 进程（宿主）
  └─ PluginHostProcess（每个插件一个，串行调用）
       node --permission --allow-fs-read=<插件目录> plugin-host-entry.js
       协议：行分隔 JSON（与 crates/wasm-host 的 sidecar 同一形态）
       调用：{ id, op: 'activate' | 'invoke' | 'deactivate', payload }
       应答：{ id, ok, result | error }
```

为什么是**每插件一个进程**而不是共享一个：一个插件崩溃/死循环不该带走另一个插件的调用，
这也正是原子那条线用 sidecar 的理由（同构，减少两套心智模型）。

---

## 二、能力中介：声明之外不存在

插件要做的每件事都走宿主 API（`IPluginContext` 已经存在，只是现在**可以选择不用**）：

| 插件想做的事 | 宿主 API | 需要的声明 |
| --- | --- | --- |
| 读业务数据 | `context.query(table, filter)` | `database.tables` 含该表且 `operations` 含 `read` |
| 写业务数据 | `context.mutate(...)` | 同上 + `write` |
| 调用宿主 HTTP 端点 | `context.callApi(path, method)` | `api.endpoints` / `api.methods` 命中 |
| 扩展模块 | `context.extendModule(name)` | `modules.extend` 含该模块 |
| 注册路由 | `manifest.routes` | 由宿主注册，插件只能**声明**不能自装 |

判定逻辑**复用原子的那一份**：`missingPermissions(declared, granted)` 逐项 all-of，
缺一项即拒（元语不变量 4：fail-closed 不回退）。这里不新写一个"插件权限检查器"。

---

## 三、静态扫描降级为信号

`plugin-security-validator` 保留，但角色从"安全判决"变成"审查线索"：

- 命中只写审计（`plugin.security.signal`），不阻断
- 协议文本里写明它**为什么不能当判决**：可绕（拼接/动态导入）、会误报（注释与字符串）
- 这与闸 3 的 S1 是同一条原则：**能被绕过或被误报的检查，不该有阻断权**

## 四、清单协议

`schemas/plugin-manifest.schema.json` 取代 `plugin-loader.service.ts` 里手写的形状校验：

```jsonc
{
  "id": "auto-parts-forecast",          // kebab-case
  "version": "1.2.0",                    // semver
  "hostApiVersion": 1,                   // 插件与宿主 API 的契约版本
  "entry": "dist/index.js",              // 相对路径，不得越出插件目录
  "permissions": {                       // 声明的能力 —— 也是**唯一**能拿到的能力
    "database": { "tables": ["orders"], "operations": ["read"] },
    "api": { "endpoints": ["/api/orders"], "methods": ["GET"] }
  },
  "routes": [ { "path": "/forecast", "method": "GET", "handler": "getForecast" } ]
}
```

## 与现有资产的关系

| 已有 | 本变更怎么用 |
| --- | --- |
| `IPluginContext` / `PluginContextProvider` | 成为**唯一**的宿主能力出口（不再允许插件自己 `require`） |
| `PluginPermissions`（领域值对象） | 清单里 permissions 的运行时形态，保留 |
| `missingPermissions`（原子权限） | 逐项 all-of 判定，直接复用 |
| `AuditLogsService` | 越权、信号、隔离进程的启停都写同一条审计出口 |
| `crates/wasm-host` 的行分隔 JSON 协议 | 子进程通信沿用同一形态（少一套心智模型） |

## 风险与对策

| 风险 | 对策 |
| --- | --- |
| 存量插件直接 `require('fs')` 会立刻失败 | tasks.md 给出迁移步骤与逐个排查清单；失败信息里写明"被哪条边界拒绝、该改哪个宿主 API" |
| `--permission` 是 Node 的（较新的）权限模型 | 协议文本记录**实测**命令与结果；宿主启动时探测一次，不可用即拒（fail-closed，不静默降级到同进程加载） |
| 每插件一个进程的成本 | 与原子 sidecar 同构；先做对，等真的成为瓶颈再谈池化 |
| 出网未覆盖 | 明确写进协议与 proposal 的边界；据此建议 v1 只允许 Tier A 插件 |
