import type {
  ObjectSchema,
  ViewSchema,
  PageSchema,
  SchemaRegistryEntry,
} from './types'

export class SchemaRegistry {
  private registry = new Map<string, SchemaRegistryEntry>()

  /**
   * Register an object schema
   */
  registerObject(name: string, schema: ObjectSchema): void {
    this.registry.set(`object:${name}`, {
      type: 'object',
      name,
      schema,
      loadedAt: Date.now(),
    })
  }

  /**
   * Register a view schema
   */
  registerView(name: string, schema: ViewSchema): void {
    this.registry.set(`view:${name}`, {
      type: 'view',
      name,
      schema,
      loadedAt: Date.now(),
    })
  }

  /**
   * Register a page schema
   */
  registerPage(path: string, schema: PageSchema): void {
    this.registry.set(`page:${path}`, {
      type: 'page',
      name: path,
      schema,
      loadedAt: Date.now(),
    })
  }

  /**
   * Get object schema
   */
  getObject(name: string): ObjectSchema | null {
    const entry = this.registry.get(`object:${name}`)
    return entry ? (entry.schema as ObjectSchema) : null
  }

  /**
   * Get view schema
   */
  getView(name: string): ViewSchema | null {
    const entry = this.registry.get(`view:${name}`)
    return entry ? (entry.schema as ViewSchema) : null
  }

  /**
   * Get page schema
   */
  getPage(path: string): PageSchema | null {
    const entry = this.registry.get(`page:${path}`)
    return entry ? (entry.schema as PageSchema) : null
  }

  /**
   * Check if schema exists
   */
  has(type: 'object' | 'view' | 'page', name: string): boolean {
    return this.registry.has(`${type}:${name}`)
  }

  /**
   * Get all schemas of a type
   */
  getAll(type: 'object' | 'view' | 'page'): SchemaRegistryEntry[] {
    return Array.from(this.registry.values()).filter(entry => entry.type === type)
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.registry.clear()
  }

  /**
   * Get registry size
   */
  size(): number {
    return this.registry.size
  }
}

export const schemaRegistry = new SchemaRegistry()
