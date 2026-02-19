# Brand Configs Table Migration Guide

## Overview

This migration creates the `brand_configs` table to support white-label branding functionality for organizations.

## Migration File

- **File**: `src/migrations/1738000000000-CreateBrandConfigsTable.ts`
- **Class**: `CreateBrandConfigsTable1738000000000`

## Table Schema

The migration creates a table with the following structure:

```sql
CREATE TABLE brand_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizationId UUID NOT NULL,
  logoUrl VARCHAR(500) NULL,
  faviconUrl VARCHAR(500) NULL,
  theme JSONB NULL,
  customCss TEXT NULL,
  appName VARCHAR(255) NULL,
  supportEmail VARCHAR(255) NULL,
  supportUrl VARCHAR(500) NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Constraints and Indexes

1. **Foreign Key**: `organizationId` → `organizations.id`
   - `ON DELETE CASCADE`: Brand configs are deleted when organization is deleted
   - `ON UPDATE CASCADE`: Updates propagate to brand configs

2. **Unique Index**: `IDX_brand_configs_organizationId`
   - Ensures one brand config per organization
   - Prevents duplicate configurations

3. **Lookup Index**: `IDX_brand_configs_organizationId_lookup`
   - Improves query performance for organization-based lookups

## Running the Migration

### Prerequisites

1. Ensure database connection is configured in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=your_username
   DB_PASSWORD=your_password
   DB_NAME=your_database
   ```

2. Ensure the `organizations` table exists (created by `MigrateToSaaS1737000000000`)

### Run Migration

```bash
cd backend
npm run migration:saas
```

Or directly:

```bash
ts-node -r tsconfig-paths/register src/migrations/run-migration.ts
```

### Expected Output

```
Database connected
Pending migrations: true
query: CREATE TABLE "brand_configs" ...
query: ALTER TABLE "brand_configs" ADD CONSTRAINT ...
query: CREATE UNIQUE INDEX "IDX_brand_configs_organizationId" ...
query: CREATE INDEX "IDX_brand_configs_organizationId_lookup" ...
Table brand_configs created successfully
Migrations completed successfully
```

## Rollback

To rollback this migration:

```bash
ts-node -r tsconfig-paths/register src/migrations/revert-migration.ts
```

Or manually:

```sql
DROP TABLE IF EXISTS brand_configs CASCADE;
```

## Verification

After running the migration, verify the table:

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'brand_configs';

-- View table structure
\d brand_configs

-- Check foreign key
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'brand_configs';

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'brand_configs';
```

## Theme JSON Structure

The `theme` column stores JSONB with this structure:

```json
{
  "primary": "#000000",
  "secondary": "#666666",
  "accent": "#0066CC",
  "background": "#FFFFFF",
  "foreground": "#000000"
}
```

## Notes

- The migration includes safety checks to prevent errors if the table already exists
- Foreign key ensures referential integrity
- Unique constraint ensures one brand config per organization
- Indexes improve query performance for common lookups

## Troubleshooting

### Error: "relation 'organizations' does not exist"

**Solution**: Run the SaaS migration first:
```bash
npm run migration:saas
```

### Error: "constraint already exists"

**Solution**: The migration checks for existing tables/indexes. If you see this error, the table may already exist. Check with:
```sql
SELECT * FROM brand_configs LIMIT 1;
```

### Error: "permission denied"

**Solution**: Ensure your database user has CREATE TABLE and CREATE INDEX permissions.

## Related Files

- **Entity**: `src/organizations/brand-config.entity.ts`
- **Repository**: `src/organization-context/infrastructure/persistence/brand-config.repository.ts`
- **Controller**: `src/organizations/brand-config.controller.ts`
- **Services**: 
  - `src/organization-context/application/services/get-brand-config.service.ts`
  - `src/organization-context/application/services/update-brand-config.service.ts`
