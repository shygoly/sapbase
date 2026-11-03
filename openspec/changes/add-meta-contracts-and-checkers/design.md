## Context

sapbase 的运行时资产已经不少：TypeORM 实体与迁移、`contracts/tools.json`、
Blueprint 编译与验签、Outbox、RLS、审计。但“文档与代码一致”仍靠人记：
新增表不进覆盖矩阵、cron 改名不同步、代码里的 `D-x` 不登记，都不会被 CI 发现。

参考包的 checker 是**零依赖 Node 脚本**，只做文本与文件系统对拍，不需要安装依赖，
适合先只读接入。真正困难的是把现有结构如实登记进四份契约，而不是写脚本。

## Goals / Non-Goals

- Goals
  - 让新增表 / cron / 决策 / 工具在 PR 阶段就能被发现“契约没同步”
  - 让存量缺口以基线形式可见，而不是掩盖
  - 让 Agent 进入仓库时能按 `##` 切片读取契约，而不是整文件加载
- Non-Goals
  - 不证明关系语义、cron 时间、工具实现是否正确（那是评审与测试）
  - 不一次性清空存量缺口
  - 不引入新依赖、不引入数据库变更

## Decisions

- Decision: 采用参考包的 `manifest` 模式，而不是让 checker 直接解析 TypeORM。
  - 理由：CI 只读已提交的 `contracts/schema-manifest.json`，避免 ORM/Node 版本差异导致基线漂移。
  - 替代方案：直接跑 TypeORM 反射——需要数据库连接且不稳定，拒绝。
- Decision: checker 放在 `scripts/meta/`，不放在 `scripts/` 根。
  - 理由：现有 `scripts/` 已有 `ci/`、`hooks/`、`lib/`，混放会污染。
  - 参考脚本中的 `./lib/common.mjs` 相对导入保持不变，整体复制。
- Decision: 基线文件 `meta-baseline.json` 与功能 PR 分离。
  - 理由：禁止顺手“洗绿”；本变更单独提交基线。
- Decision: cron 三向对拍先覆盖现有唯一 cron。
  - 现状：`suggestion-cron.ts` 只有 `@Cron('0 2 * * *')`，没有 `name` 也没有 registry。
  - 本变更补 `name: 'semantic.suggest_transitions'` 与 registry，不改调度时间与业务逻辑。

## Risks / Trade-offs

- 风险：初始 `DOMAIN.md` 覆盖矩阵可能遗漏表 → 用 `tablePrefixes: []` 校验全部表，漏表会直接报 ERR。
- 风险：TypeORM 关系未写 `@JoinColumn` 时 manifest 可能推断错 → 生成后人工抽查 3–5 张核心表。
- 风险：checker 误报导致团队绕过 → 用基线 + `--warn-only` 过渡，且基线只缩不扩。
- 权衡：本变更会产生大量文档改动，但全部是可读的契约文本，不影响运行。

## Migration Plan

1. 先提交 checker + 配置 + 空契约 + 基线，CI 只告警。
2. 再补齐 `DOMAIN.md` / `FLOWS.md` / `DECISIONS.md` / `AGENT-TOOLS.md`，逐项降低基线。
3. 回退方式：删除 CI 步骤与新增文档即可；不触及业务数据。

## Open Questions

- `contracts/tools.json` 当前存在乱码/截断字符，是否在本变更顺手修复？
  - 默认**不**顺手修，只如实索引；乱码修复另立小变更，避免把“契约接入”和“数据修复”混在一起。
- 是否把所有存量表都登记为正式小节，还是先部分用 `INV-*-GAP-*`？
  - 覆盖矩阵必须收录全部表；关系与不变量允许先用 GAP 块标注偿还条件。
