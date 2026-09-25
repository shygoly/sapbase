# Blueprint Package and Compiler Design

## 目标与范围

v1 只回答一个问题：**一份业务定义能不能被打包、编译、加载，并且它的原子依赖解析得到？**

```text
模块定义（module-registry / ai-modules）
   ↓ 导出（最小蓝图）
Blueprint 包（.erpkg = zip + manifest + 分层 + 校验和）
   ↓ 编译（校验 → 依赖闭包 → 冲突检测 → IR）
IR（文本 + 结构化）
   ↓ 加载（Loader/Verifier：哈希、manifest、依赖）
可执行计划（v1：原子依赖已解析 + 语义对象可枚举）
   ↓
原子运行时（已落地：Wasmtime sidecar）
```

**不做**：模板加密与签名验证（只留位置）、前端渲染、市场交易。

## 包格式 v1

```text
blueprint.erpkg                      # zip
├── manifest.json                    # 唯一权威入口：id/version/runtime/依赖/分层/校验和
├── semantic.json                    # 业务对象、字段、关系、状态、事件、能力
├── flows.json                       # 流程（状态机 + DAG + 事件流）
├── rules.json                       # 规则（校验/业务/策略/计算/会计）
├── forms.json                       # 表单与页面 Schema
├── bom.json                         # 物料清单与工艺
├── approval.json                    # 审批链
├── accounting.json                  # 会计事件 → 分录规则
├── connectors.json                  # 外部连接器声明（只声明，不含实现）
├── config/thresholds.json           # 可配置参数（阈值、字段映射等）
├── protected/                       # v1 只允许放占位文件；加密在 License 协议那条线
└── signature.sig                    # v1 允许缺失；校验和（sha256）必须存在
```

分层可见性（**声明在 manifest 里，加载时强制**）：

| 层 | 文件 | v1 是否强制 |
| --- | --- | --- |
| public | semantic / forms / flows / config | ✅ 校验和必须匹配 |
| configurable | config/** | ✅ 校验和必须匹配 |
| protected | protected/** | 🟡 只校验存在性与校验和；**不承诺加密**（属 License 协议） |
| kernel | —— | 不在包内（内核永远不进包） |

## manifest 形态

```json
{
  "blueprint": "auto-parts-erp",
  "version": "2026.1.0",
  "runtime": ">=1.0.0 <2.0.0",
  "dependencies": [
    { "atomic": "available-inventory", "version": "^1.0.0" },
    { "module": "inventory-core", "version": "^2.0.0" }
  ],
  "layers": {
    "public": ["semantic.json", "forms.json", "flows.json"],
    "configurable": ["config/thresholds.json"],
    "protected": []
  },
  "files": { "semantic.json": "sha256:...", "flows.json": "sha256:..." },
  "license": { "required": true, "server": null }
}
```

判据：**manifest 是唯一权威** —— 内容与 manifest 不一致（缺文件、多文件、哈希不符）一律拒。

## IR 规范（v1）

IR 是编译器的输出、Runtime 的输入，**两种形态必须等价**：

```text
结构形态  blueprint.ir.json   —— Runtime 加载用
文本形态  blueprint.ir.txt    —— 审计与 diff 用
```

文本形态是四条语句的线性序列（便于人读与代码评审）：

```text
entity SalesOrder { fields: 6, states: draft→submitted→approved→closed }
on SalesOrder.submitted:
  check Customer.credit using atomic:available-inventory@^1.0.0
  require approval PURCHASE_HIGH_VALUE when total > 100000
  post accounting SALES_INVOICE_POSTED
```

**等价性由测试保证**：`toText(parseText(x))` 与 `toText(x)` 逐字节一致（往返测试）。

## 编译流水线

```text
1. 解包 + manifest 校验（文件集合与 sha256 全匹配）
2. 逐文件 Schema 校验（缺 Schema 的文件视为非法，不跳过）
3. 依赖闭包：atomic 依赖 → AtomicRegistryService.resolve（不可用即拒）
4. 冲突检测（只做能确定性判定的四类）
5. IR 生成（结构 + 文本）
6. 产出编译结果：IR、依赖清单、内容摘要（sha256）
```

### 冲突检测：判什么、不判什么

| 判 | 判据 |
| --- | --- |
| 重复定义 | 同一 `entity`/`rule`/`flow` id 出现两次 |
| 悬空引用 | 引用了不存在的 entity / state / rule / atomic |
| 循环依赖 | entity 关系图或 flow 图的环（含自环） |
| 状态机合法性 | 初始态唯一、存在终态、无不可达态、迁移目标已声明 |
| 原子依赖不可满足 | `AtomicRegistryService.resolve` 抛错 |

**不判**（会变成假阳性来源）：命名风格、语义相似度、"这个规则写得对不对"这类需要判断的检查。

## Loader 与运行时对接

```text
Loader.load(packagePath):
  1. 解包 → 2. 验 manifest 与每个文件的 sha256 → 3. 验依赖（atomic 走 resolve）
  4. 验 IR 与包内容一致（IR 摘要 == 编译时记录）
  5. 产出 LoadedBlueprint { manifest, semantic, ir, resolvedAtomics }
任一不过 → 抛错并给出确切原因；**不提供部分加载**
```

## 与现有资产的关系

| 现有 | 本次如何用 |
| --- | --- |
| `module-registry` | 新增"导出最小蓝图"能力（模块 + 它的 `dependsOnAtomics` → 包） |
| `atomic-registry` | 编译与加载时校验原子依赖可用性（复用 `resolve`，不新造判定） |
| `shared-schemas` | 蓝图包类型放这里，前后端共用 |
| `speckit` 前端 | v1 不接（渲染属后续变更） |

## 风险与对策

| 风险 | 对策 |
| --- | --- |
| 包格式过早膨胀 | v1 只冻结"能编译能加载"所需的最小字段；扩展走 Profile |
| 冲突检测误报 | 只做确定性判据，宁可漏报也不误报（误报会让人关掉检查） |
| IR 与包内容漂移 | IR 摘要写入清单，加载时比对；往返测试保证文本/结构等价 |
| 加密位被误以为已实现 | 文档与 Schema 注释明确"v1 不承诺加密"，`protected` 只校验存在性 |
| 与 ai-modules 的固定步骤生成重复 | 导出优先复用现有模块记录，不重写生成逻辑 |
