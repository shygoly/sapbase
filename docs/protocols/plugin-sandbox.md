# 插件沙箱与能力中介（判据）

> 版本：v1
> 日期：2026-09-25
> 定位：**插件边界的唯一判据文本**。实现（`backend/src/plugins/`）只做本文件里的判定；
> 想加判据先改本文件（元语不变量 10：未冻结的协议不做实现）。
> 相关：`schemas/plugin-manifest.schema.json`（声明真源）、`docs/META_LANGUAGE.md` §3.5（Capsule）。

---

## 0. 一句话原则

**边界优先于政策**：先让能力**不存在**（拿不到），再谈"不许用"（校验）。
顺序反了，得到的就是一堆看起来安全、实际可绕的检查 —— 本变更之前的状态正是如此。

---

## 1. 边界：插件跑在受限子进程里

每个插件一个子进程，用 Node 的权限模型启动：

```bash
node --permission --allow-fs-read=<插件目录> plugin-host-entry.js
```

### 实测结果（Node v24.18.0，本仓库开发机）

```bash
node --permission -e "require('node:fs').readFileSync('/etc/hosts')"   # → ERR_ACCESS_DENIED
node --permission -e "require('node:fs').writeFileSync('/tmp/x','y')"  # → ERR_ACCESS_DENIED
node --permission -e "require('node:child_process').execSync('echo')"  # → ERR_ACCESS_DENIED
node --permission -e "new (require('node:worker_threads').Worker)('',{eval:true})"  # → ERR_ACCESS_DENIED
node --permission -e "require('node:net').connect(80,'127.0.0.1')"     # → 仍可连接（不受限制）
```

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 读文件（allowlist 外） | ❌ 拒绝 | 实测 |
| 写文件（allowlist 外） | ❌ 拒绝 | 实测 |
| `child_process` | ❌ 拒绝 | 实测 |
| `worker_threads` | ❌ 拒绝 | 实测 |
| loader/启动脚本非首入口 | ❌ 拒绝 | 模块加载路径一并受限 |
| **出网** | ⚠️ **不受限** | Node 权限模型不覆盖网络 |

### 关于"出网"这条边界（必须写在明面上）

平台能保证的是前四行；**网络不在其中**。因此：

1. 说"插件无法外泄数据"是错的，本协议不这么说；
2. 要真正限制出网，需要部署层手段（容器网络策略 / 网络命名空间 / egress 代理）；
3. 在该手段就位之前，v1 **只允许 Tier A（平台自研）插件**在共享环境运行；
   第三方插件需要能出网控制的部署形态。

把这条写清楚，比"少写一条显得更安全"重要。

### 探测与 fail-closed

宿主在加载任何插件之前 MUST 探测权限模型可用性（启动一个最小探测进程）。探测失败即**拒绝加载插件**，
MUST NOT 退回同进程 `require` —— 静默退化等于边界不存在，而"边界不存在"和"没有边界"是两件事：
前者会让读文档的人以为有。

---

## 2. 能力中介：声明之外不存在

插件能做的事全部经过宿主 API（`IPluginContext`）。每一条都对应清单里的一项声明：

| 插件想做的事 | 宿主 API | 需要的声明 |
| --- | --- | --- |
| 读业务数据 | `context.query(table, filter)` | `permissions.database.tables` 含该表 且 `operations` 含 `read` |
| 写业务数据 | `context.mutate(table, ...)` | 同上 且 `operations` 含 `write` |
| 删除业务数据 | `context.remove(table, ...)` | 同上 且 `operations` 含 `delete` |
| 调宿主端点 | `context.callApi(path, method)` | `permissions.api.endpoints` 含该路径 且 `methods` 含该方法 |
| 扩展模块 | `context.extendModule(name)` | `permissions.modules.extend` 含该模块 |
| 新建模块 | `context.createModule(...)` | `permissions.modules.create === true` |

### 判定规则（与原子同一份实现）

1. **all-of**：声明的每一项都要满足，缺一项即拒（不是"部分放行"）。
2. **拒绝原因必须指明缺哪条声明**：`PLUGIN_CAPABILITY_DENIED[missing: database.tables=orders]`，
   而不是一句"权限不足"。
3. **不回退**：不给"降级为只读""只返回缓存"之类的替代路径（元语不变量 4）。
4. 未声明 `permissions` 的插件**只能做纯计算**（宿主不提供任何数据能力），这是合法且有意义的形态。

判定复用 `missingPermissions`（原子那条线上已有的 all-of 实现），不新写一份权限检查器。

---

## 3. 判据与信号的分工

| 检查 | 类型 | 为什么 |
| --- | --- | --- |
| 进程边界（§1） | **判决** | 拿不到就是拿不到，不依赖任何文本判断 |
| 清单声明校验（Schema + 入口路径） | **判决** | 声明是能力的唯一来源；声明本身不合法就没有可信的能力清单 |
| 能力中介（§2） | **判决** | 有明确依据："违反了哪条声明" |
| 源码文本扫描 | **信号** | 见下 |

### 为什么文本扫描不能当判决

`plugin-security-validator` 用正则匹配 `require('child_process')` 一类字符串。它有两个硬伤：

- **可绕**：`require('child_' + 'process')`、`await import('node:' + name)`、`process.binding(...)`；
- **会误报**：注释、文档字符串、测试里的例子都会命中。

一条既能被绕过、又会误报的检查如果拥有阻断权，结果是：**真作恶的照过，老实人被拦住**。
所以它降级为信号 —— 命中只写审计（`plugin.security.signal`），供人工审查；
而"能不能越权"由 §1 的边界回答。

这与闸 3 的 S1（常量位信号）是同一条原则：**能被绕过或被误报的检查，不该有阻断权**。

---

## 4. 审计

以下事件都写同一条审计出口（`AuditLogsService`），字段含插件 `id` / `version` / 清单摘要：

| 事件 | 动作名 | 关键字段 |
| --- | --- | --- |
| 插件激活 / 停用 | `plugin.lifecycle` | 进程状态、启动耗时 |
| 能力调用成功 | `plugin.invoke` | 能力项（表/端点）、耗时 |
| 能力调用被拒 | `plugin.capability.denied` | **缺哪条声明** |
| 安全信号 | `plugin.security.signal` | 命中的规则与位置 |

审计是"这个插件做过什么"的唯一答案；越权也留痕，因为**失败的尝试同样是需要被看见的事实**。

---

## 5. 兼容性

- 清单协议 v1 与既有 `plugin-loader` 的形状**向后兼容**（`name` / `version` / `type` /
  `permissions` / `entry.backend` 保留原意），新增 `hostApiVersion` 与更严的路径校验。
- 已装的存量插件若直接 `require('fs')` 一类**会立刻失败**：这是本变更的目的。
  迁移步骤见 change `add-plugin-sandbox` 的 tasks.md。
- 新增判据 = 新的协议版本 + 一轮回归；不允许在实现里悄悄加一条没写进本文件的检查。
