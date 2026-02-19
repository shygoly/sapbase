/**
 * Domain entity: Plugin Permission (value object).
 */
export enum PermissionType {
  API = 'api',
  DATABASE = 'database',
  UI = 'ui',
  MODULES = 'modules',
}

export interface ApiPermission {
  type: PermissionType.API
  endpoints?: string[]
  methods?: string[]
}

export interface DatabasePermission {
  type: PermissionType.DATABASE
  tables?: string[]
  operations?: ('read' | 'write' | 'delete')[]
}

export interface UiPermission {
  type: PermissionType.UI
  components?: string[]
  pages?: string[]
}

export interface ModulesPermission {
  type: PermissionType.MODULES
  extend?: string[]
  create?: boolean
}

export type PluginPermission =
  | ApiPermission
  | DatabasePermission
  | UiPermission
  | ModulesPermission

export class PluginPermissions {
  private constructor(
    public readonly api?: ApiPermission,
    public readonly database?: DatabasePermission,
    public readonly ui?: UiPermission,
    public readonly modules?: ModulesPermission,
  ) {}

  static fromManifest(permissions: {
    api?: { endpoints?: string[]; methods?: string[] }
    database?: { tables?: string[]; operations?: string[] }
    ui?: { components?: string[]; pages?: string[] }
    modules?: { extend?: string[]; create?: boolean }
  }): PluginPermissions {
    return new PluginPermissions(
      permissions.api
        ? {
            type: PermissionType.API,
            endpoints: permissions.api.endpoints,
            methods: permissions.api.methods,
          }
        : undefined,
      permissions.database
        ? {
            type: PermissionType.DATABASE,
            tables: permissions.database.tables,
            operations: permissions.database.operations as any,
          }
        : undefined,
      permissions.ui
        ? {
            type: PermissionType.UI,
            components: permissions.ui.components,
            pages: permissions.ui.pages,
          }
        : undefined,
      permissions.modules
        ? {
            type: PermissionType.MODULES,
            extend: permissions.modules.extend,
            create: permissions.modules.create,
          }
        : undefined,
    )
  }

  hasApiAccess(endpoint: string, method: string): boolean {
    if (!this.api) return false
    if (this.api.endpoints && !this.matchesPattern(endpoint, this.api.endpoints)) {
      return false
    }
    if (this.api.methods && !this.api.methods.includes(method)) {
      return false
    }
    return true
  }

  hasDatabaseAccess(table: string, operation: 'read' | 'write' | 'delete'): boolean {
    if (!this.database) return false
    if (this.database.tables && !this.database.tables.includes(table)) {
      return false
    }
    if (
      this.database.operations &&
      !this.database.operations.includes(operation)
    ) {
      return false
    }
    return true
  }

  canExtendModule(moduleName: string): boolean {
    if (!this.modules) return false
    if (this.modules.extend && !this.modules.extend.includes(moduleName)) {
      return false
    }
    return true
  }

  canCreateModule(): boolean {
    return this.modules?.create === true
  }

  private matchesPattern(path: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$',
      )
      return regex.test(path)
    })
  }
}
