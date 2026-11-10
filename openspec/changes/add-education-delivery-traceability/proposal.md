# Change: 教育项目需求交付追踪矩阵

## Why

`docs/教育智能体定制开发详细需求说明（合作评估版）.md` 定义了 A-001—A-050、B-001—B-035
共 85 项功能要求，但当前状态分散在多个 OpenSpec change、代码模块和口头结论中：

- 平台侧已有/部分实现的 change 与教育需求条目没有一张完整映射；
- 每次代码更新后无法快速回答"还差哪些、下一项做什么、由谁交付"；
- 同一个教育需求可能同时涉及平台通用能力和教育垂直蓝图，容易重复立项或漏项。

本 change 把这些对照结果固化到仓库内，作为后续逐项完成的唯一交付台账。

## What Changes

- **ADDED** `education-delivery`：教育项目交付追踪能力
  - `traceability.md`：A-001—A-050、B-001—B-035 全量对照表，含现状、归属、目标 change、阶段、难度。
  - `tasks.md`：按阶段拆解的可勾选交付清单，每项带需求编号和目标 change。
  - 明确"继续已有 change"与"新建 change"的边界，避免重复能力。
- **NOT CHANGED** 平台运行时行为、数据库结构、接口契约。
- **NON-GOALS** 客户品牌定制、外部环境联调执行、90 天全部页面的一次性实现。

## Impact

- 受影响规格：`education-delivery`（新增）
- 受影响文件：
  - `openspec/changes/add-education-delivery-traceability/**`
  - `docs/OPENSPEC_CHANGES.md`（ledger）
- 依赖：`docs/教育智能体定制开发详细需求说明（合作评估版）.md`、
  `docs/教育智能体需求-平台能力对照矩阵.md`、当前代码与 `openspec/changes/**`。
- 迁移：无；纯追踪资产，不影响现有应用。
- 风险：追踪表会随代码变化过期，必须在每个需求项完成时同事务更新。
