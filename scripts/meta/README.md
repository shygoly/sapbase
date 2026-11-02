# 校验器（参考实现）

零依赖，Node 18+。三个 checker 分别对拍四份契约中的三份；`check-all.mjs` 顺序运行。

```text
check-domain-doc.mjs      DOMAIN.md ↔ schema manifest / SQL / 代码
check-meta-docs.mjs       FLOWS.md ↔ registry ↔ 装饰器；DECISIONS.md ↔ D-x
check-agent-tools.mjs     AGENT-TOOLS.md ↔ contracts/tools.json ↔ 处理器
check-all.mjs             依次运行上面三个
schema-manifest.typeorm.mjs  从 TypeORM 实体生成 manifest（可选适配器）
```

---

## 1. 快速开始

在仓库根：

```bash
# 1. 复制配置
cp scripts/meta/meta.config.example.json meta.config.json

# 2. 生成 schema manifest（sapbase 当前是 TypeORM）
node scripts/meta/schema-manifest.typeorm.mjs \
  --root backend/src \
  --out contracts/schema-manifest.json

# 3. Root contracts already exist: DOMAIN.md / FLOWS.md / DECISIONS.md / AGENT-TOOLS.md

# 4. 跑
node scripts/meta/check-all.mjs --warn-only
```

采用初期用 `--warn-only`，只报不挡；存量违规进 `meta-baseline.json`。

---

## 2. 参数

| 参数 | 作用 |
|---|---|
| `--config <path>` | 配置路径，默认 `meta.config.json` |
| `--warn-only` | 有 ERR 也退出 0（采用初期） |
| `--json` | 输出 JSON，CI 汇总用 |
| `--baseline <path>` | 基线文件；基线内错误降级为 WARN |
| `--update-baseline` | 把当前 ERR 写入基线（需单独 PR） |
| `--help` | 帮助 |

退出码：`0` 通过；`1` 有 ERR；`2` 配置/IO 错误。

---

## 3. 配置

`meta.config.json`（完整示例见 `meta.config.example.json`）：

```jsonc
{
  "docs": {
    "domain": "DOMAIN.md",
    "flows": "FLOWS.md",
    "decisions": "DECISIONS.md",
    "agentTools": "AGENT-TOOLS.md"
  },
  "code": {
    "roots": ["apps", "libs", "backend/src", "speckit/src"],
    "extensions": [".ts", ".tsx", ".js", ".mjs"],
    "ignoreDirs": ["node_modules", ".next", "dist", "coverage", ".nx", ".git"]
  },
  "schema": {
    "kind": "manifest",                 // manifest | prisma | sql
    "path": "contracts/schema-manifest.json",
    "tablePrefixes": [],
    "strictDbConstraints": false
  },
  "cron": {
    "registry": "apps/api/src/monitor/scheduled-job.registry.ts",
    "decoratorPatterns": ["@Cron\\([^)]*name:\\s*['\"]([^'\"]+)['\"]"]
  },
  "agentTools": {
    "contract": "contracts/tools.json",
    "handlerRoots": ["libs/agent-tools/src", "backend/src/agent-tools"],
    "handlerPattern": "(?:toolName\\s*:\\s*|case\\s+)['\"]([^'\"]+)['\"]",
    "strictHandlers": false
  },
  "sqlDirs": ["sql", "tools/postgres/init", "backend/src/migrations"]
}
```

`tablePrefixes` 为空数组表示**校验全部表**。sapbase 存量表没有统一前缀，P0 建议先设为 `[]`；
等存量清理/新表都按前缀命名后，再收窄到 `["biz_","app_","agent_","sys_"]`。

### 3.1 schema.kind

| kind | 输入 | 适用 |
|---|---|---|
| `manifest` | `{ "tables": { "biz_order": { "columns": [] } } }` | 推荐；与 ORM 解耦 |
| `prisma` | `schema.prisma` | followup 式项目 |
| `sql` | `CREATE TABLE` 文件/目录 | 以 SQL 为真源 |

生成后的 `contracts/schema-manifest.json` **要提交到仓库**：CI 只读它，不在 CI 里重新生成，
避免 ORM/Node 版本差异导致基线漂移。

sapbase 当前用 TypeORM：用 `schema-manifest.typeorm.mjs` 生成 manifest。
它解析 `@Entity` / `@Column` / `@JoinColumn` / BaseEntity / TenantAwareEntity；
未写 `@JoinColumn` 的 `ManyToOne` 按 `<prop>Id` 推断。生成后建议人工抽查 3–5 张表。

### 3.2 cron

- `registry` 必须是集中声明 `jobKey` 的文件。
- `decoratorPatterns` 是正则字符串数组；默认匹配 `@Cron(..., { name: '...' })`。
- 若项目用 BullMQ，可加 `@Process('...')` 模式，但 jobKey 仍要统一。

### 3.3 agentTools

- `handlerPattern` 默认同时匹配 `toolName: 'x'` 与 `case 'x':`。
- `strictHandlers: true` 时，处理器与契约不一致为 ERR；默认 WARN，便于渐进接入。
- 文档里处理器写 `-` 表示平台内置/由 registry 分派，不检查具体符号。

---

## 4. 基线

存量违规多时：

```bash
node scripts/check-all.mjs --baseline meta-baseline.json --update-baseline
git add meta-baseline.json
```

规则：

- 基线只缩不扩；每月 review。
- 功能 PR 里禁止顺手更新基线。
- 基线匹配是“错误文本包含”，所以错误信息要稳定；改错误文案会重置基线。

---

## 5. CI

```yaml
- run: node scripts/check-all.mjs --baseline meta-baseline.json
- run: npm run typecheck
- run: npm test
```

```jsonc
// package.json
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

---

## 6. 已知边界

- **只做一致性**：不证明关系语义正确、cron 时间合理、工具实现安全。
- **符号检查是文本包含**：注释里出现同名符号也会通过；需要更强的检查可接 AST。
- **db 约束检查默认 WARN**：TypeORM 生成的约束名可能不在静态 SQL 里；需要严格时设
  `strictDbConstraints: true`，并确保迁移文件包含约束名。
- **flow dead_edge 是启发式**：producer/consumer 未匹配只 WARN，避免误报。
- **manifest 可能漏列**：TypeORM 关系未写 `@JoinColumn` 时按约定推断；生成后请抽查。
- **不替代测试**：checker 过了不等于行为正确；测试与评测仍要跑。

---

## 7. 目录

```text
scripts/
├─ lib/common.mjs                 # 参数/配置/Markdown/YAML/文件遍历
├─ check-domain-doc.mjs
├─ check-meta-docs.mjs
├─ check-agent-tools.mjs
├─ check-all.mjs
├─ schema-manifest.typeorm.mjs
├─ meta.config.example.json
└─ README.md
```
