# Implementation Tasks

## 里程碑与验收门

| 里程碑 | 范围 | 验收门（命令 + 期望） |
| --- | --- | --- |
| **T0** 缺口实证 | 证明"装载后什么都不发生" | 记录实测：无记录入口 / 无规则执行器 / 仅 1 个原子 |
| **T1** 模板 | `templates/auto-parts-min/` 五层 | 打包→编译→安全通过；**IR 摘要可复现**；规则/经验策略引用全部可解析 |
| **T2** 语义运行时 | `blueprint_records` + 写入/读取 | jest：六道写入链各自正例与负例（未知实体/未知字段/类型错/悬空引用/违反规则/合法） |
| **T3** 生成入口 | `POST /:id/deliver` | jest：一条命令产出 .erpkg（含盖章与签名）；顺序错（先签后编）会让签名失效 —— 有测试钉住 |
| **T4** 交付端到端 | 租户 A → 租户 B | e2e：装载 → 合法写入成功 → 三类非法写入各被拦 → 调原子断言数值 |
| **T5** 反例与回归 | 前一变更的反例仍拒 | e2e：未授权/篡改/过期仍拒；全量回归全绿 |

### 执行约定

1. 每完成一项：勾选 + 附证据（命令 + 结果），不写"应该可以"。
2. **不放松任何既有闸**：本变更只新增入口；前一变更的三个反例必须继续被拒。
3. 写入路径 fail-closed：任一校验不过即拒且不落库，**不部分写入**。
4. **未知字段一律拒**（通用记录表没有列约束，放过未知字段等于把校验变成抽查）。
5. 规则执行只做 `validation` 的字面量比较；`approval.when` **不求值**（写进协议）。
6. 每个里程碑结束跑一次全量回归（单元 + e2e + wasm-modules + tsc）。

## Phase T0: 缺口实证

- [x] 记录实测：`backend/src/blueprint` 无记录写入入口；`rules-expression` 只抽取不求值；
      `wasm-modules/build/manifest.json` 只有 1 个原子（`available-inventory`）
- [x] 据此写明本变更**为什么必须**包含"语义运行时"（否则模板装载后没有可观察行为）

## Phase T1: 模板

- [x] `templates/auto-parts-min/blueprint.json`：id / 版本 / runtime / 依赖 `available-inventory`
- [x] `semantic.json`：`Part`（含 BOM 自引用关系）/ `Supplier` / `Customer` / `SalesOrder` / `StockItem`
- [x] `flows.json`：`SalesOrder` 的 `draft → confirmed → shipped → closed`（DAG）
- [x] `rules.json`：3 条 validation（可执行）+ 1 条 approval 声明（不执行）
- [x] `experience.json`：priority / confirm / automate / surfaces（**无布局字段**）
- [x] 证据：打包 → 编译通过 → `irDigest` 两次一致；故意改一处 → 摘要变

## Phase T2: 语义运行时

- [x] 迁移：`blueprint_records`（id / blueprintId / blueprintVersion / entity / organizationId / data / 时间戳 + 索引）
- [x] `backend/src/semantic-runtime/record-validator.ts`：**纯函数**，输入(模板语义 + 规则 + 记录) → 结论或原因
- [x] 写入链六步：装载 → 实体存在 → 字段名已知 → 类型匹配 → reference 存在 → validation 通过 → 落库
- [x] `POST /api/blueprints/:id/records/:entity` 与 `GET ...`（走 JwtAuthGuard，租户隔离沿用既有做法）
- [x] jest：六道链各一正一负（含"未知字段被拒"与"违反 validation 被拒"）

## Phase T3: 生成入口

- [x] `POST /api/blueprints/:id/deliver`：打包 → **盖章** → 写 license → 重打包 → **签名**
- [x] 顺序写成单一方法（调用方不各自拼装），并在注释里写明"先签后编会让签名失效"
- [x] jest：deliver 产出的包可直接被 `loadBlueprint` 装载（含授权校验）

## Phase T4: 交付端到端

- [x] e2e：租户 A 用模板 deliver（`grantedTo` 含 B）→ 租户 B 装载
- [x] 在 B 里：合法 SalesOrder 写入成功并可读回；缺 `partNo` 的 Part、`quantity=0` 的 SalesOrder、
      未知字段 —— **各被拦一次且不落库**
- [x] 调 `available-inventory`（HTTP）算可用量，断言数值与绑定哈希
- [x] 记录可复现证据（命令 + 输出）

## Phase T5: 反例与回归

- [x] e2e：未授权租户装载 / 篡改包 / 授权过期 —— 仍拒（**前一变更的反例不许变松**）
- [x] 全量回归：单元 + e2e + wasm-modules + tsc + lint + `openspec validate --strict`
- [x] `docs/protocols/` 增一节或在既有文件补：**模板 = 什么**（源码 vs 产物、约束来自校验而非数据库）
