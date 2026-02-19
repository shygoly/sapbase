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
