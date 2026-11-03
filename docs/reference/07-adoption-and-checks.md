# 07 · 落地路线与校验接入

> 这份文件回答：**从 sapbase 现状到本参考包的目标，分几步、每步交付什么、怎么验收、怎么退。**
> 原则：每一步都能独立上线；不搞大爆炸；先契约后代码；先只读后写入；先人审后自动。

---

## 0. 现状与目标差距

| 维度 | 现状 | 目标 | 差距 | 优先级 |
|---|---|---|---|---|
| Monorepo | npm workspaces（`speckit` / `backend` / `shared-schemas`） | Nx 工作区 + tags + 边界检查 | 🟡 迁移 | P1 |
| 前端 | Next.js 15 单体 `speckit` | `web-portal` + `web-console` | 🟡 拆分 | P1 |
| 后端 | NestJS 10 单体 `backend` | `api` + `agent`/`worker` 逻辑边界 | 🟡 分层 | P1 |
| ORM | TypeORM 0.3 | 保留 TypeORM；仓储端口 | ✅ 不换 | — |
| 数据库 | PG + RLS + TypeORM migration | + 发布/Agent 表 + 不可变触发器 | 🟡 增量 | P2 |
| Redis | cache-manager | + 会话/锁/幂等/SSE/限流 | 🟡 标准化 | P1 |
| 工具面 | `contracts/tools.json` + registry + 确认令牌 | 复用；补 `pi_*` / `builder_*` | ✅ 地基已好 | P1 |
| 会话 | 规则解析、无多轮 | Context Compiler + 多轮 + SSE | ⬜ 新建 | P1 |
| 发布 | Blueprint 包 + 安装/升级/回滚 | 不可变 Release + 激活 + changelog | 🟡 扩展 | P2 |
| Builder | `ai_modules` 六步定义/测试/评审 | ChangeProposal + 校验/预览 | 🟡 提升 | P2 |
| 知识 | 无 | KnowledgeEntry + 版本/范围 | ⬜ 新建 | P3 |
| 评测 | 无 | agent eval + G5 | ⬜ 新建 | P3 |
| 契约文档 | `META_LANGUAGE.md` + OpenSpec | + DOMAIN/FLOWS/DECISIONS/AGENT-TOOLS | ⬜ 新建 | P0 |
| 机器校验 | 无 | 3 个 checker + CI | ⬜ 新建 | P0 |

---

## 1. 分阶段路线

### P0 · 契约与基线（1–2 周）

**交付**

1. 根目录建 `DOMAIN.md` / `FLOWS.md` / `DECISIONS.md` / `AGENT-TOOLS.md`（用 `templates/` 骨架；
   模板里的 `D-1..D-4` 只是格式示例，采用时按现有决策递增编号，不要照抄编号）。
2. 从现有 TypeORM 实体生成 `contracts/schema-manifest.json`。
3. 把 `scripts/` 复制到根 `scripts/`，加 `meta.config.json`。
4. CI 接 `check:*`，`--warn-only` + 基线，只报不挡。
5. 根 `AGENTS.md` 加“元语入口”段（见 §4）。

**验收**

- `check:all` 能跑完，输出 ERR/WARN 数量与基线。
- `DOMAIN.md` 覆盖矩阵覆盖全部 `biz_/app_/agent_/sys_` 表（存量可先列 GAP）。
- `FLOWS.md` 调度总表与现有 cron 对得上（存量差异进基线）。
- `DECISIONS.md` 至少登记 3 条既有决策（发布/RLS/工具面）。
- 新 PR 如果新增表/cron/D-x/工具但没有改契约，CI 能报出来。

**退路**：checker 只读，不影响运行；删掉 CI 步骤即可回退。文档是新增，不改现有代码。

---

### P1 · Nx 与逻辑分层（2–4 周）

**交付**

1. `nx init` + `project.json` + tags；`nx graph` 可见。
2. `libs/shared-*`、`libs/domain-*` 抽第一批（从纯函数/类型开始）。
3. `libs/agent-kernel`（会话、Context Compiler、预算）+ `libs/agent-tools`（适配器）。
4. `api` 保留现有 Controller；`agent` 逻辑模块先同进程。
5. Redis key 规范 + 会话/幂等/限流落地。
6. `web-portal` / `web-console` 路由拆分（可先同一个 Next app 的两个 route group）。

**验收**

- `nx run-many -t build` 通过；现有 `npm run dev` 仍可用。
- `enforce-module-boundaries` 从 warn 起步，违规清单在降。
- PiAgent 能多轮对话；LLM 只通过 `IntentParser` 端口，不绕过工具网关。
- 写操作仍走确认令牌；越权/未确认写测试为 0。
- 现有业务冒烟（登录/首页/一个 CRUD/一个报表）通过。

**退路**：Nx 是增量包装；保留旧 npm scripts。若阻塞，回退到 `git revert` 单个 PR，
不丢业务代码。

---

### P2 · Release 与激活（3–4 周）

**交付**

1. `app_drafts` / `app_change_proposals` / `app_releases` / `app_release_items` /
   `app_release_activations` / `app_release_approvals` / `app_release_events`。
2. 不可变触发器 + 摘要重算 + 签名 + changelog。
3. 发布/激活/回退 API + 管理端页面。
4. 业务端 `whats-new` + 版本标识 + 缓存失效。
5. 与 `app_installations` / `app_installation_revisions` / Blueprint 对账。

**验收**

- 发布后改 `manifest` 被数据库拒绝。
- 同一安装不能有两个非 cohort 的 `active`。
- 回退 = 新 activation；旧 Release 内容不变。
- 业务用户只看到自己 org 的 active release；预览 token 无效时 403。
- 发布/激活/回退都有 `app_release_events` 与审计。
- 至少一次真实灰度 + 一次回退演练。

**退路**：新表是增量；旧安装/升级路径保留。若发布服务出问题，关闭 `release.enabled`
开关，回退到直接安装 Blueprint 的旧路径（需在代码里保留 fallback）。

---

### P3 · Knowledge 与 Eval（2–3 周）

**交付**

1. `agent_knowledge_entries` + 版本 + 范围（全局/组织/部门/个人）。
2. 知识提议 → 审核 → 发布；发布前敏感信息检查。
3. `agent_eval_runs` + 黄金集（FAQ/导航/查询/写/拒答/注入/版本）。
4. G5 接入发布闸门；评测不达标拒绝发布。
5. PiAgent 回答绑定 `releaseId + skillVersion + knowledgeVersion`。

**验收**

- 未发布知识不会出现在回答里。
- 回退知识版本后，回答恢复旧口径。
- 注入套件 100% 通过；写安全 0 越权。
- 评测报告能在发布详情里看到。

**退路**：知识检索可关；评测可先只报不挡（G5 warn），稳定后转 error。

---

### P4 · Builder 与 A1 闭环（3–4 周）

**交付**

1. `builder_*` 工具：读反馈/指标、建草稿、写提议、校验、预览、生成 changelog。
2. 提议 → 校验 → 预览 → 审批 → 发布全链路。
3. 管理端治理台：反馈列表、提议 diff、证据、影响面、审批。
4. `ai_modules` 与 `ChangeProposal` 打通（六步定义作为提议来源之一）。
5. A1 默认开启；A2 仍关闭。

**验收**

- Agent 起草的提议不能自己批准/发布（服务端拒绝）。
- 每条提议带证据；无证据直接拒绝。
- 预览链接业务用户不可见。
- 审批人能看到 diff/证据/影响/回退。
- 一次真实“反馈 → 提议 → 发布 → 业务看到”的端到端演练。

**退路**：Builder 工具可按 app 关闭；关闭后回到人工用 `ai_modules` 六步定义。

---

### P5 · A2 与持续运营（持续）

**交付**

1. A2 白名单 + 应用级开关 + 灰度 + 自动回退 + 事后复核。
2. 闭环指标看板（提议通过率/失败率/回退耗时/复发率）。
3. 季度审计：A2 使用范围、基线债务、评测趋势。
4. 文档真源合并：把本参考包并入 `META_LANGUAGE.md` / `docs/protocols/`。

**验收**

- A2 只用于白名单变更类；连续 5 次无回退。
- 自动回退演练成功；阈值生效。
- 结构性变更 0 次自动发布。
- 本目录标记“已并入”，避免双真源。

**退路**：A2 一键关闭；回到 A1 人工发布。

---

## 2. 角色与职责

| 角色 | 负责 | 不负责 |
|---|---|---|
| 平台架构 | 元语、契约格式、Nx 边界、发布模型 | 具体业务规则 |
| 应用负责人 | 本 app 的 Release、审批、激活、回退 | 平台级契约 |
| 安全/合规 | 权限变更、敏感信息、工具面审计 | 业务功能取舍 |
| 业务代表 | 反馈、验收、changelog 可读性 | 技术实现 |
| PiAgent Builder | 起草、校验、预览、changelog 草稿 | 批准/发布 |
| PiAgent Runtime | 答疑、查数、改数（确认后） | 系统定义、发布 |

**评审节奏**：

- 每周：反馈聚类 + 待审批提议。
- 每月：基线债务、评测趋势、回退复盘。
- 每季度：A2 白名单、契约格式、文档真源合并。

---

## 3. CI 接入

### 3.1 `package.json` 脚本

```jsonc
{
  "scripts": {
    "check:domain": "node scripts/check-domain-doc.mjs",
    "check:meta": "node scripts/check-meta-docs.mjs",
    "check:agent-tools": "node scripts/check-agent-tools.mjs",
    "check:all": "node scripts/check-all.mjs",
    "check:ci": "node scripts/check-all.mjs --baseline meta-baseline.json"
  }
}
```

### 3.2 CI 顺序

```yaml
- run: npm run check:ci
- run: npm run typecheck
- run: npm test
- run: npm run build
```

- `check:*` 是秒级，放最前，失败最快。
- 采用初期用 `--warn-only`；两个迭代内转 error。
- 基线文件单独 PR 更新；禁止在功能 PR 里顺手“洗绿”。
- 缓存：checker 不依赖 node_modules，直接跑。

### 3.3 PR 模板

```markdown
## 变更类型
- [ ] 数据模型（已更新 DOMAIN.md）
- [ ] 流程/定时任务（已更新 FLOWS.md）
- [ ] 架构决策（已登记 D-x）
- [ ] 智能体工具（已更新 AGENT-TOOLS.md + tools.json）
- [ ] 发布/激活（已跑 G0–G8）
- [ ] 仅文案/样式（无需契约）

## 校验
- [ ] `npm run check:ci`
- [ ] `npm test`
- [ ] 涉及 Agent：`npm run eval:agent`
```

---

## 4. 根 `AGENTS.md` 接入片段

采用后，在仓库根 `AGENTS.md` 增加（不要覆盖 OpenSpec 段）：

```markdown
## 元语入口（必读）

进入本项目先读两份元上下文：

1. `docs/META_LANGUAGE.md` —— 元模型 Ω、五协议、执行原语、总不变量、术语表。
2. `docs/reference/README.md` —— 工程落地参考（Nx/Next/Nest/PG/Redis + 四契约 + PiAgent）。
   其中 `01-meta-model.md` 的术语与不变量为补充；与 `META_LANGUAGE.md` 冲突时以后者为准。

**DOMAIN RULE**：改任何 `biz_` / `app_` / `agent_` 表、实体或 `app-*` / `domain-*` 服务前，
先读 `DOMAIN.md` 对应 `##` 小节（切片读取，勿全文加载）。改关系/级联/状态词必须同步该节，
并跑 `node scripts/check-domain-doc.mjs`。

**META RULE**：四份契约机器可校验：
- `FLOWS.md` —— cron 与业务线；改 cron 必须同步 FLOWS + registry + `@Cron(name:)`，跑 `check-meta-docs.mjs`。
- `DECISIONS.md` —— `D-x`；代码里的独立 `D-x` 标记必须登记（`TD-x` 在 `docs/tech-debt.md`）。
- `AGENT-TOOLS.md` —— 与 `contracts/tools.json` 对拍；写工具必须 `confirmation: required`。
- `DOMAIN.md` —— 表/列/关系/不变量；跑 `check-domain-doc.mjs`。

**AGENT RULE**：PiAgent 只能经 `contracts/tools.json` 的工具面操作；写操作必须确认令牌；
不得批准/发布自己起草的提议；不得把未发布知识带入回答。
```

---

## 5. 验收清单

### 5.1 契约

- [ ] `DOMAIN.md` 覆盖矩阵与 schema manifest 一致。
- [ ] 每条关系有强制点；`none` 有理由。
- [ ] 每个 `INV-x` 有 enforcement + spec（或 GAP + 偿还条件）。
- [ ] `FLOWS.md` 调度总表 = registry = 代码装饰器。
- [ ] 每条多步 flow 有 `dead_edge_check`。
- [ ] 代码里的 `D-x` 都在 `DECISIONS.md`。
- [ ] `AGENT-TOOLS.md` = `tools.json`；写工具全部 `required`。
- [ ] 工具都有处理器；处理器都有契约。

### 5.2 发布

- [ ] `published` Release 内容不可变（触发器测试）。
- [ ] 摘要平台重算；客户端值不采信。
- [ ] 同一安装只有一个非 cohort `active`。
- [ ] 回退 = 新 activation；旧 Release 不改。
- [ ] 每个 Release 有 changelog、迁移计划、回退计划。
- [ ] 业务请求/Agent turn 记录 `releaseId`。
- [ ] 预览 token 无效时 403；业务用户看不到预览。

### 5.3 PiAgent

- [ ] 工具白名单生效；未声明工具不可调用。
- [ ] 写操作无令牌必拒；令牌一次性/过期/参数不匹配必拒。
- [ ] 权限 all-of；越权测试 0 通过。
- [ ] 回答带 release/skill/knowledge 版本。
- [ ] 不可信内容 nonce 包裹；注入套件 100%。
- [ ] 失败不假装成功；不自动换工具绕过。
- [ ] 审计成功/失败都写；敏感参数脱敏。

### 5.4 进化闭环

- [ ] 反馈有脱敏、有 trace、有 release。
- [ ] 提议有证据、diff、风险、测试、回退。
- [ ] Agent 不能批准/发布自己的提议。
- [ ] A2 白名单 + 开关 + 灰度 + 自动回退 + 事后复核。
- [ ] 结构性变更 0 次自动发布。
- [ ] 回退演练成功，指标恢复。

---

## 6. 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Nx 迁移影响现有构建 | 中 | 高 | 增量包装；每步可回退；迁移与升级分开 |
| 契约文档变成“第二真源” | 中 | 中 | 采用后合并进 `META_LANGUAGE.md`；本目录标记已并入 |
| checker 误报导致团队绕过 | 中 | 中 | 基线 + warn-only 过渡；只挡新增 |
| Release 模型与 Blueprint 重复 | 中 | 中 | Release 只做目录/激活；包格式仍以 Blueprint 为准 |
| Agent 写操作出事 | 低 | 高 | 确认令牌 + 幂等 + 回读 + 审计；先只读 |
| 权限变更导致业务看不到数据 | 中 | 高 | G2 安全审批 + 灰度 + 回退 |
| 迁移不可回退 | 中 | 高 | expand/contract；G3 dry-run；`rollbackSafe` |
| 评测不稳定 | 高 | 中 | 固定模型/温度/种子；硬门槛只留写安全/注入 |
| A2 范围蔓延 | 中 | 高 | 白名单只缩不扩；季度审计；一键关闭 |
| 租户数据泄露 | 低 | 极高 | 可信上下文 + RLS + 跨租户测试 + 审计 |

---

## 7. 不要做什么

1. **不要**在 P0 就改业务代码；先让契约只读跑起来。
2. **不要**在 Nx 迁移 PR 里升级 Nest/Next/ORM。
3. **不要**让 PiAgent 直接连数据库或生成 SQL。
4. **不要**用“提示词”代替权限、确认、审计。
5. **不要**让 Agent 批准/发布自己的提议。
6. **不要**把“发布”做成覆盖同名包。
7. **不要**在没有回退演练前开 A2。
8. **不要**让 `docs/reference` 与 `docs/META_LANGUAGE.md` 长期并行；采用后必须合并。
9. **不要**为了让 check 过而删表/删契约；补归属或登记 GAP。
10. **不要**把基线当垃圾桶；基线只能缩小。

---

## 8. 采用后的文档归并

| 本参考包 | 并入哪里 | 时机 |
|---|---|---|
| `01-meta-model.md` 的术语/不变量 | `docs/META_LANGUAGE.md` §4/§6 | P1 结束 |
| `02-architecture.md` | `docs/ARCHITECTURE.md` 或 `openspec/project.md` | P1 结束 |
| `03-contracts.md` | 根 `DOMAIN.md` / `FLOWS.md` / `DECISIONS.md` / `AGENT-TOOLS.md` 的附录 | P0–P1 |
| `04-versioning-release.md` | `docs/protocols/release.md` | P2 结束 |
| `05-piagent.md` | `docs/protocols/piagent.md` | P3 结束 |
| `06-evolution-loop.md` | `docs/protocols/agent-evolution.md` | P4 结束 |
| `07-adoption-and-checks.md` | `CONTRIBUTING.md` / CI 文档 | P1 结束 |
| `scripts/` | 根 `scripts/` | P0 |
| `templates/` | 根目录四份契约的初始版本 | P0 |

归并完成后的验收：

- 根 `AGENTS.md` 只指向一份定义层 + 一份工程参考；
- `docs/reference/README.md` 标注“已并入，保留作历史”；
- 全仓检索不到两份互相矛盾的契约文本。

---

## 9. 一句话总结

> 先用**契约**让系统“说得清”，再用**发布**让变更“退得回”，
> 然后用**PiAgent Runtime**让业务人员“用得顺”，最后才用**Builder + A2**让系统“自己长”。
> 顺序反了，任何一步都会变成不可控的自动化。
