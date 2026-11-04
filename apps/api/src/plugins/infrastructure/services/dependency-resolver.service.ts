import { Injectable, BadRequestException } from '@nestjs/common'
import { satisfies } from 'semver'
import type { PluginManifest } from '../../domain/entities/plugin.entity'
import type {
  IDependencyResolver,
  DependencyCheck,
  DependencyResolutionResult,
} from '../../domain/services'

@Injectable()
export class DependencyResolverService implements IDependencyResolver {
  async resolveDependencies(
    manifest: PluginManifest,
    installedPlugins: Array<{ name: string; version: string }>,
  ): Promise<DependencyResolutionResult> {
    const missing: DependencyCheck[] = []
    const incompatible: DependencyCheck[] = []

    // Check plugin dependencies
    if (manifest.dependencies?.plugins) {
      for (const dep of manifest.dependencies.plugins) {
        const installed = installedPlugins.find((p) => p.name === dep.name)

        if (!installed) {
          missing.push({
            name: dep.name,
            requiredVersion: dep.version,
            installed: false,
            compatible: false,
          })
        } else {
          const compatible = satisfies(installed.version, dep.version)
          if (!compatible) {
            incompatible.push({
              name: dep.name,
              requiredVersion: dep.version,
              installed: true,
              installedVersion: installed.version,
              compatible: false,
            })
          }
        }
      }
    }

    // Check system version
    if (manifest.dependencies?.system?.minVersion) {
      const systemCompatible = this.checkSystemVersion(
        manifest.dependencies.system.minVersion,
      )
      if (!systemCompatible) {
        incompatible.push({
          name: 'system',
          requiredVersion: manifest.dependencies.system.minVersion,
          installed: true,
          installedVersion: '1.0.0', // TODO: Get actual system version
          compatible: false,
        })
      }
    }

    // Check for circular dependencies
    const circular = this.detectCircularDependencies(
      manifest.name,
      manifest.dependencies?.plugins || [],
      installedPlugins,
    )

    const canInstall = missing.length === 0 && incompatible.length === 0 && !circular

    return {
      canInstall,
      missing,
      incompatible,
      circular,
    }
  }

  checkSystemVersion(requiredVersion: string): boolean {
    // TODO: Get actual system version from config
    const systemVersion = '1.0.0'
    try {
      return satisfies(systemVersion, `>=${requiredVersion}`)
    } catch {
      return false
    }
  }

  detectCircularDependencies(
    pluginName: string,
    dependencies: Array<{ name: string; version: string }>,
    installedPlugins: Array<{ name: string; version: string }>,
  ): boolean {
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const checkCircular = (name: string): boolean => {
      if (visiting.has(name)) {
        return true // Circular dependency detected
      }
      if (visited.has(name)) {
        return false // Already checked
      }

      visiting.add(name)

      // Find dependencies of this plugin
      const plugin = installedPlugins.find((p) => p.name === name)
      // TODO: Load plugin manifest to check its dependencies
      // For now, we'll do a simple check

      visiting.delete(name)
      visited.add(name)
      return false
    }

    for (const dep of dependencies) {
      if (checkCircular(dep.name)) {
        return true
      }
    }

    return false
  }
}
