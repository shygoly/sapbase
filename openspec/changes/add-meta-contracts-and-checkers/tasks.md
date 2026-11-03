## 1. 复制 Checker 与配置

- [x] 1.1 新建 `scripts/meta/`，从 `docs/reference/scripts/` 复制 `check-domain-doc.mjs`、`check-meta-docs.mjs`、`check-agent-tools.mjs`、`check-all.mjs`、`schema-manifest.typeorm.mjs`、`meta.config.example.json`、`README.md`
- [x] 1.2 复制 `docs/reference/scripts/lib/common.mjs` 到 `scripts/meta/lib/common.mjs`，确认相对导入可用
- [x] 1.3 新建根 `meta.config.json`：`docs` 指向根四契约；`code.roots` 覆盖 `backend/src`、`speckit/src`、`shared-schemas`、`wasm-modules`；`schema.path` 指向 `contracts/schema-manifest.json`；`cron.registry` 指向 `backend/src/monitor/scheduled-job.registry.ts`；`agentTools.contract` 指向 `contracts/tools.json`
- [x] 1.4 确认 `meta.config.json` 的 `schema.tablePrefixes` 为 `[]`（先校验全部存量表），`strictDbConstraints: false`

## 2. 生成 Schema Manifest

- [x] 2.1 运行 `node scripts/meta/schema-manifest.typeorm.mjs --root backend/src --out contracts/schema-manifest.json`
- [x] 2.2 人工抽查至少 5 张核心表（`app_installations`、`app_installation_revisions`、`audit_logs`、`agent_confirmation_tokens`、`outbox_events`）的表名与列名
- [x] 2.3 把 `contracts/schema-manifest.json` 提交入库；CI 不重新生成

## 3. 建立四份根契约

- [x] 3.1 用 `docs/reference/templates/DOMAIN.template.md` 建 `DOMAIN.md`：覆盖矩阵收录 manifest 中全部表，一表一行；按聚合分 `##` 小节，每节写 `覆盖表：`；关系表与 `yaml invariant` 块按格式契约填写；未知/待补项用 `INV-<AREA>-GAP-<NN>` 并在 `desc` 写偿还条件
- [x] 3.2 用 `docs/reference/templates/FLOWS.template.md` 建 `FLOWS.md`：调度总表登记 `semantic.suggest_transitions`；为多步业务线写 `yaml flow` 与 `dead_edge_check`；单步 flow 可省略 dead edge
- [x] 3.3 用 `docs/reference/templates/DECISIONS.template.md` 建 `DECISIONS.md`：至少登记 D-1 发布不可变、D-2 保留 TypeORM、D-3 PiAgent 只经工具面、D-4 作者 ≠ 批准人；`code_markers` 指向真实存在的文件
- [x] 3.4 用 `docs/reference/templates/AGENT-TOOLS.template.md` 建 `AGENT-TOOLS.md`：工具表与 `contracts/tools.json` 完全一致（含超时、敏感参数、处理器）；处理器不存在时写 `-`
- [x] 3.5 四份契约末尾保留“附录：格式契约 / 命名空间约定”，与 `docs/reference/03-contracts.md` 一致

## 4. 打通 Cron 三向对拍

- [x] 4.1 新建 `backend/src/monitor/scheduled-job.registry.ts`，声明 `SCHEDULED_JOBS = [{ jobKey: 'semantic.suggest_transitions', cron: '0 2 * * *', timeoutMs: 60000, idempotent: true }] as const`
- [x] 4.2 在 `backend/src/semantic-runtime/suggestion-cron.ts` 把 `@Cron('0 2 * * *')` 改为 `@Cron('0 2 * * *', { name: 'semantic.suggest_transitions' })`
- [x] 4.3 更新 `suggestion-cron.spec.ts`（如断言了装饰器或全仓唯一 cron），确保仍通过
- [x] 4.4 确认 `check-meta-docs.mjs` 的 cron 集合三向相等

## 5. 接入 npm 与 CI

- [x] 5.1 根 `package.json` 增加 `check:domain`、`check:meta`、`check:agent-tools`、`check:all`、`check:ci`
- [x] 5.2 新建 `meta-baseline.json`（初始可为空对象），用 `node scripts/meta/check-all.mjs --warn-only` 跑出存量问题
- [x] 5.3 若存量问题较多，用 `--update-baseline` 生成基线并**单独提交**；基线只缩不扩
- [x] 5.4 在 `.github/workflows/ci.yml` 的 `validate` job 最前面加 `npm run check:ci`（初始加 `--warn-only`），失败不阻断
- [x] 5.5 确认 `npm run check:all` 退出 0 或有 ERR；`--json` 输出可供 CI 汇总

## 6. 更新入口文档

- [x] 6.1 根 `AGENTS.md` 增加“元语入口（必读）”段，保留 OpenSpec managed block
- [x] 6.2 DOMAIN RULE：改 `biz_/app_/agent_/sys_` 表或 `app-*/domain-*` 服务前先读对应 `##` 小节，并跑 `check-domain-doc.mjs`
- [x] 6.3 META RULE：cron 三处同步；代码独立 `D-x` 必须登记；`AGENT-TOOLS.md` 与 `tools.json` 对拍
- [x] 6.4 AGENT RULE：PiAgent 只经 `contracts/tools.json`，写操作必须确认令牌，不得批准/发布自己起草的提议

## 7. 验收

- [x] 7.1 `node scripts/meta/check-domain-doc.mjs` 通过（ERR 为 0，基线内 WARN 可接受）
- [x] 7.2 `node scripts/meta/check-meta-docs.mjs` 通过（cron 三向相等）
- [x] 7.3 `node scripts/meta/check-agent-tools.mjs` 通过（文档 = tools.json）
- [x] 7.4 `npm run check:all` 可重复运行，结果稳定
- [x] 7.5 在临时分支新增一张表但不同步 `DOMAIN.md`，确认 CI 能报出 ERR
