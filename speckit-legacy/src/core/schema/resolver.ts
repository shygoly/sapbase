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
  async resolvePage(path: string): Promise<ResolvedPageSchema> {
    // Load page schema
    const pageSchema = await this.loadPageSchema(path)
    if (!pageSchema) {
      throw new Error(`Page schema not found: ${path}`)
    }

    // Load view schema
    const viewSchema = await this.loadViewSchema(pageSchema.view)
    if (!viewSchema) {
      throw new Error(`View schema not found: ${pageSchema.view}`)
    }

    // Load object schema
    const objectSchema = await this.loadObjectSchema(viewSchema.object)
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
  async loadObjectSchema(name: string): Promise<ObjectSchema | null> {
    if (this.objectCache.has(name)) {
      return this.objectCache.get(name)!
    }

    try {
      const response = await fetch(`/specs/objects/${name}.json`)
      if (!response.ok) return null

      const schema = (await response.json()) as ObjectSchema
      this.objectCache.set(name, schema)
      return schema
    } catch {
      return null
    }
  }

  /**
   * Load view schema
   */
  async loadViewSchema(name: string): Promise<ViewSchema | null> {
    if (this.viewCache.has(name)) {
      return this.viewCache.get(name)!
    }

    try {
      const response = await fetch(`/specs/views/${name}.json`)
      if (!response.ok) return null

      const schema = (await response.json()) as ViewSchema
      this.viewCache.set(name, schema)
      return schema
    } catch {
      return null
    }
  }

  /**
   * Load page schema
   */
  async loadPageSchema(path: string): Promise<PageSchema | null> {
    if (this.pageCache.has(path)) {
      return this.pageCache.get(path)!
    }

    try {
      const response = await fetch(`/specs/pages/${path}.json`)
      if (!response.ok) return null

      const schema = (await response.json()) as PageSchema
      this.pageCache.set(path, schema)
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
    if (type === 'object') {
      this.objectCache.delete(name)
    } else if (type === 'view') {
      this.viewCache.delete(name)
    } else if (type === 'page') {
      this.pageCache.delete(name)
    }
  }
}

// Singleton instance
export const schemaResolver = new SchemaResolver()
