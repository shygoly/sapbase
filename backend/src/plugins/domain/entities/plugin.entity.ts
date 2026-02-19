/**
 * Domain entity: Plugin (pure, no TypeORM).
 */
export enum PluginStatus {
  INSTALLED = 'installed',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

export enum PluginType {
  INTEGRATION = 'integration',
  UI = 'ui',
  THEME = 'theme',
}

export interface PluginManifest {
  name: string
  version: string
  type: PluginType
  description?: string
  author?: string
  license?: string
  permissions: {
    api?: {
      endpoints?: string[]
      methods?: string[]
    }
    database?: {
      tables?: string[]
      operations?: string[]
    }
    ui?: {
      components?: string[]
      pages?: string[]
    }
    modules?: {
      extend?: string[]
      create?: boolean
    }
  }
  dependencies?: {
    plugins?: Array<{ name: string; version: string }>
    system?: { minVersion: string }
  }
  entry: {
    backend: string
    frontend?: string
  }
  config?: Record<string, unknown>
  hooks?: {
    onInstall?: string
    onActivate?: string
    onDeactivate?: string
    onUninstall?: string
  }
  api?: {
    routes?: Array<{
      path: string
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      handler: string
    }>
  }
  ui?: {
    components?: Array<{
      name: string
      path: string
      type: 'component' | 'page' | 'widget'
    }>
    theme?: {
      variables?: Record<string, string>
      styles?: string
    }
  }
}

export class Plugin {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    private readonly _manifest: PluginManifest,
    private _status: PluginStatus,
    public readonly installPath: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get manifest(): PluginManifest {
    return this._manifest
  }

  get status(): PluginStatus {
    return this._status
  }

  get name(): string {
    return this._manifest.name
  }

  get version(): string {
    return this._manifest.version
  }

  get type(): PluginType {
    return this._manifest.type
  }

  static create(
    id: string,
    organizationId: string,
    manifest: PluginManifest,
    installPath: string,
  ): Plugin {
    return new Plugin(
      id,
      organizationId,
      manifest,
      PluginStatus.INSTALLED,
      installPath,
      new Date(),
      new Date(),
    )
  }

  static fromPersistence(
    id: string,
    organizationId: string,
    manifest: PluginManifest,
    status: PluginStatus,
    installPath: string,
    createdAt: Date,
    updatedAt: Date,
  ): Plugin {
    return new Plugin(
      id,
      organizationId,
      manifest,
      status,
      installPath,
      createdAt,
      updatedAt,
    )
  }

  activate(): void {
    if (this._status === PluginStatus.ACTIVE) {
      return
    }
    this._status = PluginStatus.ACTIVE
    this.updateTimestamp()
  }

  deactivate(): void {
    if (this._status === PluginStatus.INACTIVE) {
      return
    }
    this._status = PluginStatus.INACTIVE
    this.updateTimestamp()
  }

  setError(): void {
    this._status = PluginStatus.ERROR
    this.updateTimestamp()
  }

  private updateTimestamp(): void {
    ;(this as any).updatedAt = new Date()
  }
}
