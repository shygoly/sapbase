# Database Migrations

This directory contains database migration files for the application.

## Running Migrations

### Run all pending migrations

```bash
npm run migration:saas
```

Or directly:

```bash
ts-node -r tsconfig-paths/register src/migrations/run-migration.ts
```

### Revert last migration

```bash
ts-node -r tsconfig-paths/register src/migrations/revert-migration.ts
```

## Migration Files

- `1707000001000-EnhanceAuditLogTable.ts` - Enhanced audit log table
- `1707000002000-CreateSettingsTable.ts` - User settings table
- `1737000000000-MigrateToSaaS.ts` - SaaS migration (organizations, members, invitations)
- `1737129600000-CreateAIModuleDefinitionTable.ts` - AI module definitions table
- `1737500000000-CreateWorkflowTables.ts` - 工作流三张表
- `1738000000000-CreateBrandConfigsTable.ts` / `1739000000000-CreatePluginsTable.ts`
- `1790300000000-CreateAtomicRegistry.ts` 起的原子系列（含 `outputAudit` / `releaseEvidence` 列）

---

## 两条路径：存量库 vs 空库

迁移集是**按增量叠在早期库上**的：把它理解成"一份能建出整库的脚本"会踩坑。
正确的两张地图如下（结论来自 `scripts/verify-from-zero.ts` 的实测，不是推测）：

| 场景 | 命令 | 说明 |
| --- | --- | --- |
| 存量库加东西 | `npx ts-node --transpile-only scripts/run-targeted-migration.ts --group=atomic` | 只跑与本次工作相关的那组迁移，避免牵动无关历史迁移 |
| 空库重建 | `npx ts-node --transpile-only scripts/verify-from-zero.ts --db=sapbase_rebuild` | **squash 基线**：从实体定义一次建成整张 schema，并断言"实体与库无结构差异" |

### 空库为什么不能靠"回放历史迁移"

实测过，走不通：基线把 `audit_logs` 按实体建全后，历史迁移 `EnhanceAuditLogTable`
还要 `ADD COLUMN changes` → `column "changes" ... already exists`；
而按 `backend/AGENTS.md` 第 3 条，**历史迁移一旦提交不许改写**。

所以空库走 squash 基线（`src/migrations/schema-baseline*.ts`，由
`scripts/generate-schema-baseline.ts` 从实体生成，不要手改）：
一次建成当前 schema，历史迁移连同基线写进 `migrations` 台账（表示"已被基线吸收"），
之后 `migration:run` 不会再执行它们。这是 Rails / Django 做 squash 的通行做法。

两端终点由 `verify-from-zero.ts` 断言：30 张实体表全在，且 TypeORM 的 schema 差异里
**没有结构差异**（仅剩 3 处 jsonb 默认值的写法差异 `'[]'` vs `'[]'::jsonb`，
在 Postgres 里是同一个默认值）。

### 已知边界

- `data-source.ts` 里的迁移清单是**手写的子集**（早于本约定），`npm run migration:run`
  只覆盖其中一部分。新增迁移请同时更新该清单或走定向运行器。
- `synchronize: true` 只在临时库上用（`scripts/generate-schema-baseline.ts` 有库名白名单），
  绝不指向开发库：它会改表结构。
- `1737500000000-CreateWorkflowTables.ts` - Workflow tables (definitions, instances)
- `1738000000000-CreateBrandConfigsTable.ts` - Brand configuration table for white-labeling

## Creating New Migrations

1. Create a new migration file following the naming convention: `{timestamp}-{Description}.ts`
2. Implement `MigrationInterface` with `up()` and `down()` methods
3. Add the migration file path to `data-source.ts` migrations array
4. Run the migration using `npm run migration:saas`

## Migration Naming Convention

- Use timestamp format: `{timestamp}-{Description}.ts`
- Timestamp should be unique and sequential
- Description should be PascalCase and descriptive

Example: `1738000000000-CreateBrandConfigsTable.ts`

## Notes

- Migrations are run in order based on the timestamp
- Always test migrations in a development environment first
- Ensure `down()` method properly reverses `up()` changes
- Check for table existence before creating/dropping to avoid errors
