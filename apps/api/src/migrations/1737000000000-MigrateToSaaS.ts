import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm'

export class MigrateToSaaS1737000000000 implements MigrationInterface {
  name = 'MigrateToSaaS1737000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create organizations table
    await queryRunner.createTable(
      new Table({
        name: 'organizations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'stripeCustomerId',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'stripeSubscriptionId',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'stripeProductId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'planName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'subscriptionStatus',
            type: 'varchar',
            length: '50',
            default: "'incomplete'",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // 2. Create organization_members table
    await queryRunner.createTable(
      new Table({
        name: 'organization_members',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'role',
            type: 'varchar',
            length: '50',
            default: "'member'",
          },
          {
            name: 'joinedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'invitedById',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // 3. Create invitations table
    await queryRunner.createTable(
      new Table({
        name: 'invitations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'role',
            type: 'varchar',
            length: '50',
            default: "'member'",
          },
          {
            name: 'invitedById',
            type: 'uuid',
          },
          {
            name: 'invitedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'token',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // 4. Create organization_activities table
    await queryRunner.createTable(
      new Table({
        name: 'organization_activities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // 5. Add organizationId to all tenant-scoped tables
    const tenantScopedTables = [
      'departments',
      'roles',
      'audit_logs',
      'settings',
      'permissions',
      'menu_items',
      'ai_modules',
      'module_registry',
    ]

    for (const tableName of tenantScopedTables) {
      // Check if table exists
      const table = await queryRunner.getTable(tableName)
      if (!table) {
        console.log(`Table ${tableName} does not exist, skipping...`)
        continue
      }

      // Check if organizationId column already exists
      const hasOrgId = table.columns.find((col) => col.name === 'organizationId')
      if (hasOrgId) {
        console.log(`Table ${tableName} already has organizationId column, skipping...`)
        continue
      }

      // Add organizationId column (nullable initially for migration)
      await queryRunner.addColumn(
        tableName,
        new TableColumn({
          name: 'organizationId',
          type: 'uuid',
          isNullable: true, // Will be populated during migration
        }),
      )

      // Add foreign key
      await queryRunner.createForeignKey(
        tableName,
        new TableForeignKey({
          columnNames: ['organizationId'],
          referencedTableName: 'organizations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      )

      // Add index for performance
      await queryRunner.createIndex(
        tableName,
        new TableIndex({
          name: `idx_${tableName}_organization`,
          columnNames: ['organizationId'],
        }),
      )
    }

    // 6. Add unique constraint for roles (organizationId + name)
    const rolesTable = await queryRunner.getTable('roles')
    if (rolesTable) {
      await queryRunner.createIndex(
        'roles',
        new TableIndex({
          name: 'idx_role_organization_name',
          columnNames: ['organizationId', 'name'],
          isUnique: true,
        }),
      )
    }

    // 7. Add unique constraint for permissions (organizationId + name)
    const permissionsTable = await queryRunner.getTable('permissions')
    if (permissionsTable) {
      await queryRunner.createIndex(
        'permissions',
        new TableIndex({
          name: 'idx_permission_organization_name',
          columnNames: ['organizationId', 'name'],
          isUnique: true,
        }),
      )
    }

    // 8. Create foreign keys for organization_members
    await queryRunner.createForeignKey(
      'organization_members',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'organization_members',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'organization_members',
      new TableForeignKey({
        columnNames: ['invitedById'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )

    // 9. Create foreign keys for invitations
    await queryRunner.createForeignKey(
      'invitations',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'invitations',
      new TableForeignKey({
        columnNames: ['invitedById'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    // 10. Create foreign keys for organization_activities
    await queryRunner.createForeignKey(
      'organization_activities',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'organization_activities',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )

    // 11. Create indexes for performance
    await queryRunner.createIndex(
      'organization_members',
      new TableIndex({
        name: 'idx_organization_member_org',
        columnNames: ['organizationId'],
      }),
    )

    await queryRunner.createIndex(
      'organization_members',
      new TableIndex({
        name: 'idx_organization_member_user',
        columnNames: ['userId'],
      }),
    )

    await queryRunner.createIndex(
      'organization_members',
      new TableIndex({
        name: 'idx_organization_member_unique',
        columnNames: ['organizationId', 'userId'],
        isUnique: true,
      }),
    )

    await queryRunner.createIndex(
      'invitations',
      new TableIndex({
        name: 'idx_invitation_org',
        columnNames: ['organizationId'],
      }),
    )

    await queryRunner.createIndex(
      'invitations',
      new TableIndex({
        name: 'idx_invitation_token',
        columnNames: ['token'],
        isUnique: true,
      }),
    )

    await queryRunner.createIndex(
      'organization_activities',
      new TableIndex({
        name: 'idx_org_activity_org',
        columnNames: ['organizationId'],
      }),
    )

    await queryRunner.createIndex(
      'organization_activities',
      new TableIndex({
        name: 'idx_org_activity_timestamp',
        columnNames: ['timestamp'],
      }),
    )

    // 12. Create default organization and migrate existing data
    console.log('Creating default organization...')
    const defaultOrgResult = await queryRunner.query(`
      INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'Default Organization', 'default', 'active', NOW(), NOW())
      RETURNING id
    `)
    const defaultOrgId = defaultOrgResult[0].id
    console.log(`Created default organization: ${defaultOrgId}`)

    // 13. Migrate users to organization members
    console.log('Migrating users to organization members...')
    const users = await queryRunner.query('SELECT id, "createdAt" FROM users')
    for (const user of users) {
      await queryRunner.query(
        `
        INSERT INTO organization_members (id, "organizationId", "userId", role, "joinedAt", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, 'owner', COALESCE($3, NOW()), NOW(), NOW())
        ON CONFLICT DO NOTHING
      `,
        [defaultOrgId, user.id, user.createdAt],
      )
    }
    console.log(`Migrated ${users.length} users`)

    // 14. Migrate existing data to default organization
    for (const tableName of tenantScopedTables) {
      const table = await queryRunner.getTable(tableName)
      if (!table) continue

      const hasOrgId = table.columns.find((col) => col.name === 'organizationId')
      if (!hasOrgId) continue

      console.log(`Migrating ${tableName}...`)
      const result = await queryRunner.query(
        `UPDATE ${tableName} SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
        [defaultOrgId],
      )
      // PostgreSQL UPDATE returns rowCount
      const rowCount = (result as any)?.rowCount || 0
      console.log(`Migrated ${rowCount} rows in ${tableName}`)
    }

    // 15. Make organizationId NOT NULL after migration
    for (const tableName of tenantScopedTables) {
      const table = await queryRunner.getTable(tableName)
      if (!table) continue

      const orgIdColumn = table.columns.find((col) => col.name === 'organizationId')
      if (!orgIdColumn || !orgIdColumn.isNullable) continue

      console.log(`Making organizationId NOT NULL for ${tableName}...`)
      try {
        await queryRunner.query(`ALTER TABLE ${tableName} ALTER COLUMN "organizationId" SET NOT NULL`)
      } catch (error) {
        console.warn(`Failed to set organizationId NOT NULL for ${tableName}:`, error)
        // Continue with other tables
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove organizationId columns from tenant-scoped tables
    const tenantScopedTables = [
      'departments',
      'roles',
      'audit_logs',
      'settings',
      'permissions',
      'menu_items',
      'ai_modules',
      'module_registry',
    ]

    for (const tableName of tenantScopedTables) {
      const table = await queryRunner.getTable(tableName)
      if (!table) continue

      const orgIdColumn = table.columns.find((col) => col.name === 'organizationId')
      if (!orgIdColumn) continue

      // Drop foreign key
      const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.includes('organizationId'))
      if (foreignKey) {
        await queryRunner.dropForeignKey(tableName, foreignKey)
      }

      // Drop index
      const index = table.indices.find((idx) => idx.columnNames.includes('organizationId'))
      if (index) {
        await queryRunner.dropIndex(tableName, index)
      }

      // Drop column
      await queryRunner.dropColumn(tableName, 'organizationId')
    }

    // Drop organization-related tables
    await queryRunner.dropTable('organization_activities')
    await queryRunner.dropTable('invitations')
    await queryRunner.dropTable('organization_members')
    await queryRunner.dropTable('organizations')
  }
}
