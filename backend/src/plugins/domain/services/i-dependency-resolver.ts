import type { PluginManifest } from '../entities/plugin.entity'

export interface DependencyCheck {
  name: string
  requiredVersion: string
  installed: boolean
  installedVersion?: string
  compatible: boolean
}

export interface DependencyResolutionResult {
  canInstall: boolean
  missing: DependencyCheck[]
  incompatible: DependencyCheck[]
  circular: boolean
}

/**
 * Service interface: Dependency Resolver
 */
export interface IDependencyResolver {
  resolveDependencies(
    manifest: PluginManifest,
    installedPlugins: Array<{ name: string; version: string }>,
  ): Promise<DependencyResolutionResult>
  checkSystemVersion(requiredVersion: string): boolean
  detectCircularDependencies(
    pluginName: string,
    dependencies: Array<{ name: string; version: string }>,
    installedPlugins: Array<{ name: string; version: string }>,
  ): boolean
}

export const DEPENDENCY_RESOLVER = Symbol('IDependencyResolver')
