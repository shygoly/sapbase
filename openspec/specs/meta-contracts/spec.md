# meta-contracts Specification

## Purpose
TBD - created by archiving change add-meta-contracts-and-checkers. Update Purpose after archive.
## Requirements
### Requirement: Root Contract Documents

仓库根目录 SHALL 维护 `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`、`AGENT-TOOLS.md` 四份契约，并保持参考包定义的机器可解析格式。

#### Scenario: DOMAIN covers every manifest table
- **WHEN** `contracts/schema-manifest.json` 中存在任意一张表
- **THEN** `DOMAIN.md` 覆盖矩阵 MUST 恰好收录该表一行
- **AND** 该表 MUST 出现在覆盖矩阵指向的 `##` 小节中，并写 `覆盖表：` 行

#### Scenario: AGENT-TOOLS matches tool contract
- **WHEN** `contracts/tools.json` 增删或修改一个工具
- **THEN** `AGENT-TOOLS.md` 工具表 MUST 与之集合相等且字段一致
- **AND** 写工具 MUST 声明 `confirmation: required`

#### Scenario: Decisions register code markers
- **WHEN** 代码中出现独立的 `D-<数字>` 标记
- **THEN** `DECISIONS.md` MUST 存在同名 `yaml decision` 块
- **AND** `TD-x` MUST 不被当作 `D-x` 要求登记

### Requirement: Committed Schema Manifest

系统 SHALL 提交由 TypeORM 实体生成的 `contracts/schema-manifest.json`，CI 只读该文件，不在 CI 中重新生成。

#### Scenario: Manifest generation is reproducible
- **WHEN** 在仓库根运行 `node scripts/meta/schema-manifest.typeorm.mjs --root backend/src --out contracts/schema-manifest.json`
- **THEN** 生成的表与列 MUST 来自 `backend/src` 的实体声明
- **AND** 生成结果 MUST 提交入库，供 checker 与评审共同使用

#### Scenario: Missing relation metadata is inferred
- **WHEN** 某个 `ManyToOne` 未显式声明 `@JoinColumn`
- **THEN** 生成器 MAY 按 `<property>Id` 推断外键列
- **AND** 采用人 MUST 人工抽查核心表，确认推断合理

### Requirement: Zero-Dependency Contract Checkers

系统 SHALL 提供不依赖 `node_modules` 的 checker，用于对拍四份契约与代码。

#### Scenario: All checks pass
- **WHEN** 运行 `npm run check:all`
- **THEN** 所有 checker MUST 完成
- **AND** 无 ERR 时进程 MUST 以退出码 0 结束

#### Scenario: Contract drift is reported
- **WHEN** 代码新增表但 `DOMAIN.md` 未更新
- **THEN** `check-domain-doc` MUST 输出 ERR 并以退出码 1 结束
- **AND** 错误信息 MUST 指向缺失的表名与文件

#### Scenario: Warn-only adoption
- **WHEN** 运行 checker 时传入 `--warn-only`
- **THEN** ERR MUST 被打印但退出码仍为 0
- **AND** 该模式 MUST 只用于采用初期

### Requirement: CI Contract Gate

CI SHALL 在类型检查、测试与构建之前运行契约校验，并支持基线以处理存量债务。

#### Scenario: New PR is checked early
- **WHEN** 提交 PR
- **THEN** CI MUST 先运行 `npm run check:ci`
- **AND** 该步骤 MUST 位于 typecheck / test / build 之前

#### Scenario: Baseline only shrinks
- **WHEN** 基线中的问题已被修复
- **THEN** 维护者 MUST 在独立 PR 中缩小基线
- **AND** 功能 PR MUST NOT 顺手扩大基线

### Requirement: Agent Entry Points

根 `AGENTS.md` SHALL 指向唯一的元语真源与四份契约，并要求 Agent 按 `##` 切片读取。

#### Scenario: New agent session finds truth sources
- **WHEN** Agent 进入仓库
- **THEN** `AGENTS.md` MUST 指向 `docs/META_LANGUAGE.md`、`openspec/project.md` 和四份根契约
- **AND** MUST 说明改表/改 cron/改工具前的必跑 checker

#### Scenario: Contract change requires checker update
- **WHEN** 修改任一契约格式
- **THEN** 对应 checker MUST 在同一变更中更新
- **AND** checker 未更新 MUST 视为契约未完成

