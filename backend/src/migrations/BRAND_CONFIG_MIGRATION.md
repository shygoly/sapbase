# Brand Configs Table Migration

## Migration File

`1738000000000-CreateBrandConfigsTable.ts`

## Description

Creates the `brand_configs` table for white-label branding functionality. This table stores organization-specific branding configurations including logos, themes, custom CSS, and app branding.

## Table Structure

```sql
CREATE TABLE brand_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizationId VARCHAR(255) NOT NULL,
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

## Constraints

- **Foreign Key**: `organizationId` references `organizations.id` with CASCADE delete
- **Unique Index**: One brand config per organization (`IDX_brand_configs_organizationId`)
- **Lookup Index**: Fast lookups by organization ID (`IDX_brand_configs_organizationId_lookup`)

## Theme JSON Structure

The `theme` column stores a JSONB object with the following structure:

```json
{
  "primary": "#000000",
  "secondary": "#666666",
  "accent": "#0066CC",
  "background": "#FFFFFF",
  "foreground": "#000000"
}
```

## Running the Migration

### Using npm script:

```bash
npm run migration:saas
```

### Direct execution:

```bash
ts-node -r tsconfig-paths/register src/migrations/run-migration.ts
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

After running the migration, verify the table was created:

```sql
-- Check table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'brand_configs';

-- Check table structure
\d brand_configs

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'brand_configs';

-- Check foreign keys
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
```

## Notes

- The migration checks if the table already exists before creating it
- Foreign key constraint ensures data integrity
- Unique index ensures one brand config per organization
- CASCADE delete ensures brand configs are deleted when organizations are deleted
