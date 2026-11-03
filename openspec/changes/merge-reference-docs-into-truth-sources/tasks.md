## 1. 归并元模型与不变量

- [x] 1.1 对照 `docs/reference/01-meta-model.md`，把术语表新增项并入 `docs/META_LANGUAGE.md` §6（Release/Activation/Draft/Proposal/Feedback/Knowledge/Eval/SkillSet 等）
- [x] 1.2 把 `INV-REL-01..10`、`INV-AGENT-01..12`、`INV-EVO-01..10` 并入 `docs/META_LANGUAGE.md` 的不变量章节
- [x] 1.3 把 `D-1..D-4` 与 `TD-x` 命名空间约定并入决策/术语说明
- [x] 1.4 更新 `docs/META_LANGUAGE.md` §5.2 文档真源表：加入 `DOMAIN.md`、`FLOWS.md`、`DECISIONS.md`、`AGENT-TOOLS.md`、`docs/ARCHITECTURE.md`、`docs/protocols/release.md`、`piagent.md`、`agent-evolution.md`
- [x] 1.5 删除与真源冲突的重复表述；确需保留的历史说明标注“历史”

## 2. 归并工程架构

- [x] 2.1 新建 `docs/ARCHITECTURE.md`：合并 `02-architecture.md` 的目标目录、Nx tags、依赖规则、运行拓扑、PG/Redis/Next/Nest/Worker 约定
- [x] 2.2 在 `docs/ARCHITECTURE.md` 中注明“TypeORM 保留、不在此迁移 Prisma”的决策，并链接 `DECISIONS.md`
- [x] 2.3 更新 `openspec/project.md`：技术栈补充 Nx 工作区状态；文档真源指向新架构文档
- [x] 2.4 确认 `docs/ARCHITECTURE.md` 与实际 Nx 配置一致（变更 2 落地后的 tags 与脚本）

## 3. 归并协议文档

- [x] 3.1 新建 `docs/protocols/release.md`：合并 `04-versioning-release.md` 的对象、状态机、semver、G0–G8、预览/灰度/激活、回退、DDL 说明、API 草案、权限分离、反模式
- [x] 3.2 新建 `docs/protocols/piagent.md`：合并 `05-piagent.md` 的双 profile、Context Envelope、Runtime/Builder 能力、工具面、安全边界、记忆/知识、预算、审计、评测、失败降级、API/SSE
- [x] 3.3 新建 `docs/protocols/agent-evolution.md`：合并 `06-evolution-loop.md` 的 A0–A3、A2 白名单、闭环、信号/归并/提议/校验/预览/审批/发布/观察/沉淀、不变量与反模式
- [x] 3.4 确认 `docs/protocols/chat-erp.md` 与 `piagent.md` 不重复定义同一协议；重复处改为引用
- [x] 3.5 把 `03-contracts.md` 的格式契约保留在根四契约附录中；`docs/ARCHITECTURE.md` 只引用，不复述第二版

## 4. 归并采用与 CI 流程

- [x] 4.1 把 `07-adoption-and-checks.md` 的 CI 顺序、PR 模板、验收清单并入 `CONTRIBUTING.md`
- [x] 4.2 在 `CONTRIBUTING.md` 增加“改契约/改表/改 cron/改工具”的检查清单
- [x] 4.3 更新 `scripts/meta/README.md` 的路径引用，不再指向 `docs/reference/scripts`
- [x] 4.4 确认 `.github/PULL_REQUEST_TEMPLATE.md` 与 `CONTRIBUTING.md` 的检查项一致

## 5. 入口与历史标记

- [x] 5.1 更新根 `AGENTS.md`：移除“参考包作为第二入口”的表述；只指向 `docs/META_LANGUAGE.md`、`openspec/project.md`、`docs/ARCHITECTURE.md`、根四契约
- [x] 5.2 更新 `docs/reference/README.md`：顶部标注“已并入，保留作历史”，列出合并映射与日期
- [x] 5.3 删除 `docs/reference/01-meta-model.md` 至 `07-adoption-and-checks.md`、`templates/`、`scripts/` 的提取副本
- [x] 5.4 保留 `docs/reference.zip` 作为历史归档，并在 README 说明“不是入口，不参与校验”
- [x] 5.5 全仓检索 `docs/reference/` 的引用，确保只剩历史说明或 zip 说明

## 6. 漂移审计

- [x] 6.1 新建季度审计清单（可放在 `CONTRIBUTING.md` 或 `docs/ARCHITECTURE.md` 附录）：术语漂移、重复契约、死链、入口分叉、基线债务
- [x] 6.2 建立“同一主题只允许一份权威文本”的评审规则
- [x] 6.3 抽查 10 个跨文档链接，确认无死链
- [x] 6.4 跑 `npm run check:all`，确认归并没有破坏 checker

## 7. 验收

- [x] 7.1 根 `AGENTS.md` 只指向一份定义层 + 一份工程参考 + 四份契约
- [x] 7.2 `docs/reference/README.md` 标注“已并入”
- [x] 7.3 全仓检索不到两份互相矛盾的契约文本
- [x] 7.4 `docs/META_LANGUAGE.md` 含 Release/PiAgent/进化闭环的术语与不变量
- [x] 7.5 `docs/protocols/release.md`、`piagent.md`、`agent-evolution.md` 可独立阅读
