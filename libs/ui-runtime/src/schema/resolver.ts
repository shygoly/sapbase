import type {
  ObjectSchema,
  ViewSchema,
  PageSchema,
  ResolvedPageSchema,
  FieldDefinition,
  PermissionRule,
} from './types'

export class SchemaResolver {
  private objectCache = new Map<string, ObjectSchema>()
  private viewCache = new Map<string, ViewSchema>()
  private pageCache = new Map<string, PageSchema>()

  /**
   * Resolve a complete page schema with all references
   */
  async resolvePage(path: string, version?: number): Promise<ResolvedPageSchema> {
    // Load page schema
    const pageSchema = await this.loadPageSchema(path, version)
    if (!pageSchema) {
      throw new Error(`Page schema not found: ${path}`)
    }

    // Load view schema
    const viewSchema = await this.loadViewSchema(pageSchema.view, version)
    if (!viewSchema) {
      throw new Error(`View schema not found: ${pageSchema.view}`)
    }

    // Load object schema
    const objectSchema = await this.loadObjectSchema(viewSchema.object, version)
    if (!objectSchema) {
      throw new Error(`Object schema not found: ${viewSchema.object}`)
    }

    // Resolve fields based on view layout
    const fields = this.resolveFields(
      objectSchema.fields,
      viewSchema.layout?.fields
    )

    // Merge permissions from all levels
    const permissions = this.mergePermissions([
      this.extractPermissionRules(pageSchema.permissions),
      viewSchema.permissions || [],
      this.extractPermissionRules(objectSchema.permissions),
    ])

    return {
      path: pageSchema.path,
      type: viewSchema.type,
      fields,
      permissions,
      actions: viewSchema.actions,
      metadata: pageSchema.metadata,
      lifecycle: pageSchema.lifecycle,
    }
  }

  /**
   * Load object schema
   */
  async loadObjectSchema(name: string, version?: number): Promise<ObjectSchema | null> {
    const cacheKey = version ? `${name}@v${version}` : name
    if (this.objectCache.has(cacheKey)) {
      return this.objectCache.get(cacheKey)!
    }

    try {
      const url = version
        ? `/specs/versions/${name}/v${version}.json`
        : `/specs/objects/${name}.json`
      const response = await fetch(url)
      if (!response.ok) return null

      const schema = (await response.json()) as ObjectSchema
      this.objectCache.set(cacheKey, schema)
      return schema
    } catch {
      return null
    }
  }

  /**
   * Load view schema
   */
  async loadViewSchema(name: string, version?: number): Promise<ViewSchema | null> {
    const cacheKey = version ? `${name}@v${version}` : name
    if (this.viewCache.has(cacheKey)) {
      return this.viewCache.get(cacheKey)!
    }

    try {
      const url = version
        ? `/specs/versions/${name}/v${version}.json`
        : `/specs/views/${name}.json`
      const response = await fetch(url)
      if (!response.ok) return null

      const schema = (await response.json()) as ViewSchema
      this.viewCache.set(cacheKey, schema)
      return schema
    } catch {
      return null
    }
  }

  /**
   * Load page schema
   * @param identifier - Can be a path (e.g., '/crm/customers') or filename (e.g., 'customers')
   */
  async loadPageSchema(identifier: string, version?: number): Promise<PageSchema | null> {
    // Extract filename from path if it's a full path
    let filename = identifier
    if (identifier.startsWith('/')) {
      // Extract the last segment from path (e.g., '/crm/customers' -> 'customers')
      filename = identifier.split('/').filter(Boolean).pop() || identifier
    }

    const cacheKey = version ? `${filename}@v${version}` : filename
    if (this.pageCache.has(cacheKey)) {
      return this.pageCache.get(cacheKey)!
    }

    try {
      const url = version
        ? `/specs/versions/${filename}/v${version}.json`
        : `/specs/pages/${filename}.json`
      const response = await fetch(url)
      if (!response.ok) return null

      const schema = (await response.json()) as PageSchema
      this.pageCache.set(cacheKey, schema)
      // Also cache by path if it's different
      if (schema.path && schema.path !== filename) {
        this.pageCache.set(`${schema.path}${version ? `@v${version}` : ''}`, schema)
      }
      return schema
    } catch {
      return null
    }
  }

  /**
   * Resolve fields based on layout configuration
   */
  private resolveFields(
    allFields: FieldDefinition[],
    layoutFields?: string[]
  ): FieldDefinition[] {
    if (!layoutFields || layoutFields.length === 0) {
      return allFields.filter(f => !f.hidden)
    }

    return layoutFields
      .map(fieldName => allFields.find(f => f.name === fieldName))
      .filter((f): f is FieldDefinition => f !== undefined && !f.hidden)
  }

  /**
   * Extract permission rules from permission object or array
   */
  private extractPermissionRules(
    permissions?: Record<string, string[]> | string[]
  ): PermissionRule[] {
    if (!permissions) return []

    // Handle string array (simple permissions)
    if (Array.isArray(permissions)) {
      return permissions.map(perm => ({
        field: '*',
        action: 'view' as const,
        permissions: [perm],
      }))
    }

    // Handle permission object
    const rules: PermissionRule[] = []
    for (const [action, perms] of Object.entries(permissions)) {
      rules.push({
        field: '*',
        action: action as 'view' | 'edit' | 'delete',
        permissions: perms,
      })
    }
    return rules
  }

  /**
   * Merge permission rules from multiple sources
   */
  private mergePermissions(
    permissionArrays: PermissionRule[][]
  ): PermissionRule[] {
    const merged = new Map<string, PermissionRule>()

    for (const rules of permissionArrays) {
      for (const rule of rules) {
        const key = `${rule.field}:${rule.action}`
        if (merged.has(key)) {
          const existing = merged.get(key)!
          existing.permissions = [...new Set([...existing.permissions, ...rule.permissions])]
        } else {
          merged.set(key, { ...rule })
        }
      }
    }

    return Array.from(merged.values())
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.objectCache.clear()
    this.viewCache.clear()
    this.pageCache.clear()
  }

  /**
   * Clear specific cache
   */
  clearCacheFor(type: 'object' | 'view' | 'page', name: string): void {
    const cache =
      type === 'object' ? this.objectCache : type === 'view' ? this.viewCache : this.pageCache
    for (const key of Array.from(cache.keys())) {
      if (key === name || key.startsWith(`${name}@v`)) cache.delete(key)
    }
  }
}

// Singleton instance
export const schemaResolver = new SchemaResolver()
