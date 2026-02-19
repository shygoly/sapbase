import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'
import { PLUGIN_REPOSITORY } from '../../domain/repositories'
import { PLUGIN_LOADER, DEPENDENCY_RESOLVER } from '../../domain/services'
import type { IPluginRepository } from '../../domain/repositories'
import type { IPluginLoader, IDependencyResolver } from '../../domain/services'
import { Plugin, PluginStatus } from '../../domain/entities/plugin.entity'
import { PluginRuntimeService } from '../../infrastructure/runtime/plugin-runtime.service'
import { PluginContextProvider } from '../../infrastructure/runtime/plugin-context-provider.service'
import {
  PLUGIN_EVENT_EMITTER,
  PluginEventType,
} from '../../domain/services/i-plugin-event-emitter'
import type { IPluginEventEmitter } from '../../domain/services/i-plugin-event-emitter'
import { PluginSecurityValidatorService } from '../../infrastructure/security/plugin-security-validator.service'

export interface InstallPluginCommand {
  zipPath: string
  organizationId: string
}

export interface ActivatePluginCommand {
  pluginId: string
  organizationId: string
}

export interface DeactivatePluginCommand {
  pluginId: string
  organizationId: string
}

export interface UninstallPluginCommand {
  pluginId: string
  organizationId: string
}

@Injectable()
export class PluginLifecycleService {
  private readonly pluginsDir: string

  constructor(
    @Inject(PLUGIN_REPOSITORY)
    private readonly pluginRepository: IPluginRepository,
    @Inject(PLUGIN_LOADER)
    private readonly pluginLoader: IPluginLoader,
    @Inject(DEPENDENCY_RESOLVER)
    private readonly dependencyResolver: IDependencyResolver,
    private readonly pluginRuntime: PluginRuntimeService,
    private readonly contextProvider: PluginContextProvider,
    @Inject(PLUGIN_EVENT_EMITTER)
    private readonly eventEmitter: IPluginEventEmitter,
    private readonly securityValidator: PluginSecurityValidatorService,
  ) {
    this.pluginsDir = path.join(process.cwd(), 'plugins')
  }

  async install(command: InstallPluginCommand): Promise<Plugin> {
    // Load and validate manifest
    const manifest = await this.pluginLoader.loadManifest(command.zipPath)

    // Perform security validation
    const securityResult =
      await this.securityValidator.validatePluginPackage(
        command.zipPath,
        manifest,
      )

    if (!securityResult.isValid) {
      throw new BadRequestException(
        `Security validation failed: ${securityResult.errors.join('; ')}`,
      )
    }

    // Log warnings if any
    if (securityResult.warnings.length > 0) {
      console.warn(
        `Security warnings for plugin ${manifest.name}: ${securityResult.warnings.join('; ')}`,
      )
    }

    // Check if plugin already installed
    const existing = await this.pluginRepository.findByName(
      manifest.name,
      command.organizationId,
    )
    if (existing) {
      throw new BadRequestException(
        `Plugin ${manifest.name} is already installed`,
      )
    }

    // Check dependencies
    const installedPlugins = await this.pluginRepository.findAll(
      command.organizationId,
    )
    const depResult = await this.dependencyResolver.resolveDependencies(
      manifest,
      installedPlugins.map((p) => ({ name: p.name, version: p.version })),
    )

    if (!depResult.canInstall) {
      const errors: string[] = []
      if (depResult.missing.length > 0) {
        errors.push(
          `Missing dependencies: ${depResult.missing.map((d) => d.name).join(', ')}`,
        )
      }
      if (depResult.incompatible.length > 0) {
        errors.push(
          `Incompatible dependencies: ${depResult.incompatible.map((d) => d.name).join(', ')}`,
        )
      }
      if (depResult.circular) {
        errors.push('Circular dependency detected')
      }
      throw new BadRequestException(errors.join('; '))
    }

    // Create plugin directory
    const pluginId = uuidv4()
    const pluginDir = path.join(
      this.pluginsDir,
      command.organizationId,
      pluginId,
    )
    await fs.mkdir(pluginDir, { recursive: true })

    // Extract plugin
    await this.pluginLoader.extractPlugin(command.zipPath, pluginDir)

    // Verify entry point exists
    await this.pluginLoader.loadPluginCode(pluginDir, manifest.entry.backend)

    // Create plugin entity
    const plugin = Plugin.create(
      pluginId,
      command.organizationId,
      manifest,
      pluginDir,
    )

    // Save to repository
    await this.pluginRepository.save(plugin)

    // Call onInstall hook if exists
    if (manifest.hooks?.onInstall) {
      await this.callHook(plugin, manifest.hooks.onInstall, 'install')
    }

    // Emit installed event
    this.eventEmitter.emit({
      type: PluginEventType.INSTALLED,
      pluginId: plugin.id,
      pluginName: plugin.name,
      organizationId: plugin.organizationId,
      timestamp: new Date(),
      metadata: {
        version: plugin.version,
        type: plugin.type,
      },
    })

    return plugin
  }

  async activate(command: ActivatePluginCommand): Promise<Plugin> {
    const plugin = await this.pluginRepository.findById(
      command.pluginId,
      command.organizationId,
    )

    if (!plugin) {
      throw new NotFoundException('Plugin not found')
    }

    if (plugin.status === PluginStatus.ACTIVE) {
      return plugin
    }

    // Load plugin code into runtime
    await this.pluginRuntime.loadPlugin(plugin)

    plugin.activate()
    await this.pluginRepository.save(plugin)

    // Call onActivate hook if exists
    if (plugin.manifest.hooks?.onActivate) {
      await this.callHook(plugin, plugin.manifest.hooks.onActivate, 'activate')
    }

    // Emit activated event
    this.eventEmitter.emit({
      type: PluginEventType.ACTIVATED,
      pluginId: plugin.id,
      pluginName: plugin.name,
      organizationId: plugin.organizationId,
      timestamp: new Date(),
    })

    return plugin
  }

  async deactivate(command: DeactivatePluginCommand): Promise<Plugin> {
    const plugin = await this.pluginRepository.findById(
      command.pluginId,
      command.organizationId,
    )

    if (!plugin) {
      throw new NotFoundException('Plugin not found')
    }

    if (plugin.status === PluginStatus.INACTIVE) {
      return plugin
    }

    // Unload plugin from runtime
    await this.pluginRuntime.unloadPlugin(command.pluginId)

    // Call onDeactivate hook if exists
    if (plugin.manifest.hooks?.onDeactivate) {
      await this.callHook(
        plugin,
        plugin.manifest.hooks.onDeactivate,
        'deactivate',
      )
    }

    plugin.deactivate()
    await this.pluginRepository.save(plugin)

    // Emit deactivated event
    this.eventEmitter.emit({
      type: PluginEventType.DEACTIVATED,
      pluginId: plugin.id,
      pluginName: plugin.name,
      organizationId: plugin.organizationId,
      timestamp: new Date(),
    })

    return plugin
  }

  async uninstall(command: UninstallPluginCommand): Promise<void> {
    const plugin = await this.pluginRepository.findById(
      command.pluginId,
      command.organizationId,
    )

    if (!plugin) {
      throw new NotFoundException('Plugin not found')
    }

    // Unload from runtime if active
    if (plugin.status === PluginStatus.ACTIVE) {
      await this.pluginRuntime.unloadPlugin(command.pluginId)
      plugin.deactivate()
    }

    // Call onUninstall hook if exists
    if (plugin.manifest.hooks?.onUninstall) {
      await this.callHook(
        plugin,
        plugin.manifest.hooks.onUninstall,
        'uninstall',
      )
    }

    // Remove plugin files
    try {
      await fs.rm(plugin.installPath, { recursive: true, force: true })
    } catch (error) {
      // Log error but continue with database cleanup
      console.error('Failed to remove plugin files:', error)
    }

    // Remove from repository
    await this.pluginRepository.delete(command.pluginId, command.organizationId)

    // Emit uninstalled event
    this.eventEmitter.emit({
      type: PluginEventType.UNINSTALLED,
      pluginId: plugin.id,
      pluginName: plugin.name,
      organizationId: plugin.organizationId,
      timestamp: new Date(),
    })
  }

  private async callHook(
    plugin: Plugin,
    hookName: string,
    lifecycle: string,
  ): Promise<void> {
    try {
      const entryPath = path.join(
        plugin.installPath,
        plugin.manifest.entry.backend,
      )

      // Check if entry file exists
      try {
        await fs.access(entryPath)
      } catch {
        // Entry file doesn't exist, skip hook
        console.log(
          `Plugin ${plugin.name} entry file not found, skipping ${hookName} hook`,
        )
        return
      }

      // Load plugin module
      let pluginModule: any
      try {
        delete require.cache[require.resolve(entryPath)]
        pluginModule = require(entryPath)
      } catch (loadError: any) {
        console.warn(
          `Could not load plugin ${plugin.name} for hook ${hookName}: ${loadError.message}`,
        )
        return
      }

      // Get hook function from module
      // Support both named exports (hooks.onInstall) and default export with hooks property
      const hookFunction =
        pluginModule[hookName] ||
        pluginModule.hooks?.[hookName] ||
        pluginModule.default?.[hookName] ||
        pluginModule.default?.hooks?.[hookName]

      if (!hookFunction || typeof hookFunction !== 'function') {
        console.log(
          `Plugin ${plugin.name} does not implement ${hookName} hook`,
        )
        return
      }

      // Create context for hook execution
      const context = this.contextProvider.createContext(plugin)

      // Call hook with context
      await hookFunction(context)

      console.log(
        `Successfully called ${hookName} hook for plugin ${plugin.name}`,
      )
    } catch (error) {
      console.error(
        `Error calling ${lifecycle} hook (${hookName}) for plugin ${plugin.name}:`,
        error,
      )
      // Don't fail installation/activation if hook fails
      // But log it for debugging
    }
  }
}
