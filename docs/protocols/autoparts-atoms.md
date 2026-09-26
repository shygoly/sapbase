# 汽配原子 ABI（ATP / 价格 / 信用 / 换算 / 替代链）

> 版本：v1
> 日期：2026-09-26
> 定位：五个汽配**计算型**原子的 ABI 列布局、错误码、标度、权限点与溢出边界。
> 实现真源：`wasm-modules/modules/autoparts-*-rust/`；契约真源：`backend/src/atomic-runtime/autoparts-contracts.ts`。
> 相关：`schemas/atomic-contract.schema.json`、[`atomic-output-audit.md`](./atomic-output-audit.md)、design §3.4。

---

## 0. 共同约定

ABI v1 **只支持 i32 列**。金额与数量一律用**整数小单位**，模块内禁止浮点。

| 项 | 约定 |
| --- | --- |
| 导出 | `run(in_off, n, out_off) -> i32`（0=成功）+ `abi_version() -> 1` |
| 布局 | 列优先：各输入列 n 个 i32 连续排列；输出各列同形，**末格 total** |
| 非法参数 | `n < 0` 或偏移为负 → 错误码 `1`（`INVALID_ARGUMENT`） |
| 溢出 | 中间量用 i64，结果放不进 i32 → 错误码 `8`（`OVERFLOW`）。**不许静默回绕** |
| 值域 | i32 全区间 `[-2147483648, 2147483647]`，除非列声明了更窄的 `minimum`/`maximum` |
| 确定性 | 无时间 / 随机 / 环境读取；同样输入必得同样输出 |
| 零能力 | `no_std`、空依赖、不导入除宿主 memory 外的任何东西；`run` 内不分配 |

标度（宿主约定，不进模块）：

| 领域 | 标度 | 例子 |
| --- | --- | --- |
| 数量（UoM） | 3 | `2.500` 箱 = `2500` |
| 金额（价格 / 信用） | 由宿主自定，模块按整数原样算 | spec 场景用 `100000` 表示额度本身 |

---

## 1. `autoparts-atp`

权限点：`autoparts.atp.invoke`

| 方向 | 列（顺序即 ABI 顺序） |
| --- | --- |
| 输入 | `onHand` / `reserved` / `committed` / `inTransit` / `replacedBy` |
| 输出 | `atp` / `counted` / `replacedBy`（回显）；`total` = 合并后可承诺量 |

- 第 0 行 = 被查询的零件；`replacedBy[j] = k` 表示 j 被下标 k 替代（`-1` = 无）。
- 每行 `atp = onHand − reserved − committed + inTransit`。
- `counted[j] = 1` 当且仅当从 j 沿 `replacedBy` 能走到 0（含 j=0）。
- `total = Σ counted[j] × atp[j]`。
- 闸 3：`outputAudit: off`。行间有图语义，逐行重放会把下标打飞，O4 会得到假阴性。

错误码：`1` 参数非法；`2` `SUPERSESSION_CYCLE`（成环或越界）；`8` 溢出。

判据：X 在库 5、Y 在库 3、`Y.replacedBy=0` → 查 X 得 8；只投影 Y → 3。存量 10、预留 3、在途 2 → 9。

---

## 2. `autoparts-uom-convert`

权限点：`autoparts.uom.invoke`

| 方向 | 列 |
| --- | --- |
| 输入 | `qtyMinor` / `numerator` / `denominator` / `rounding` |
| 输出 | `convertedMinor`；`total` = 各行之和 |

- 算法：`(qtyMinor × numerator) / denominator`，纯整数。
- `rounding=0`：必须整除，否则 `3` `INEXACT_CONVERSION`。
- `rounding=1`：half-up（`|余数| × 2 ≥ |分母|` 则远离 0 进一）。禁止浮点。
- `denominator <= 0` 或 `numerator < 0` 或非法 rounding → `4` `INVALID_RATIO`。
- 闸 3：`standard`（行独立，O4 可判）。

判据：1 箱 = 12 套，2.5 箱 → `qtyMinor=2500, numerator=12, denominator=1` ⇒ `30000`（30.000）。

---

## 3. `autoparts-price`

权限点：`autoparts.price.invoke`

| 方向 | 列 |
| --- | --- |
| 输入 | `kind` / `minQty` / `priceMinor` |
| 输出 | `selected` / `kind` / `priceMinor`；`total` = 中选价格 |

`kind`：`0` 客户等级价 / `1` 阶梯价 / `2` 最近成交价 / `3` 标准价。

选择规则（唯一、确定）：最小 `kind` → 同 `kind` 最大 `minQty` → 仍并列取**下标最小**。`kind=3` 必须存在，否则 `5` `NO_STANDARD_PRICE`。非法 `kind` → `6` `INVALID_KIND`。

闸 3：`off`。候选行不是独立样本，逐行重放会丢掉标准价锚点。

---

## 4. `autoparts-credit`

权限点：`autoparts.credit.invoke`

| 方向 | 列 |
| --- | --- |
| 输入 | `limitMinor` / `receivableMinor` / `inFlightMinor` / `orderMinor` |
| 输出 | `availableMinor` / `overLimit` / `limitMinor` / `receivableMinor` / `orderMinor`；`total` = `availableMinor` |

- `available = limit − receivable − inFlight`
- `overLimit = order > available ? 1 : 0`
- 依据三项必须回显：禁止只返回通过/不通过。
- 任一入参为负 → `7` `NEGATIVE_INPUT`。
- 闸 3：`standard`。

判据：额度 100000、应收 90000、本单 20000（在途 0）⇒ `overLimit=1`，依据含三个数。

---

## 5. `autoparts-supersession`

权限点：`autoparts.supersession.invoke`

| 方向 | 列 |
| --- | --- |
| 输入 | `replacedBy` |
| 输出 | `canonical`（最末端下标）/ `depth`（跳数）；`total` = 不同 canonical 的个数 |

旧件 → 新件，单向。宿主按 `canonical` 合并数量。成环或越界 → `2`，**不返回部分结果**。走图有界（最多 n 步），不分配。

闸 3：`off`（与 ATP 同样的图语义）。

---

## 6. 为什么车辆适配匹配不做成原子

design §3.4：ATP / 价格 / 信用 / 换算 / 替代件是**给定输入必得输出**的纯计算，适合零能力沙箱。

车辆适配（车型 / 年款 / 位置 → 零件候选）需要**跨表检索**。把它塞进原子，等于把"零能力"换成"半个数据库客户端"——审查面从一份 `run` 扩散成受限 SQL 方言，闸 0/1 挡不住查库通道。

所以适配匹配走**宿主查询**，不进本文件的五个原子；批次分配同理（下一阶段）。

---

## 7. 登记与调用

- 契约 + 实现登记：`registerAutopartsContracts()`（读清单、重算哈希、闸 4 补录）。部署入口：`backend/src/seeds/autoparts-atoms.seed.ts`。
- 调用：`POST /atomic-contracts/:type/invoke`，body `{ version, records }`。缺权限点 → **403** 且审计留痕。
- **不要**把这五个原子写进 `templates/auto-parts` 的 `dependencies`：既有装载 e2e 会因此必须先登记它们。
