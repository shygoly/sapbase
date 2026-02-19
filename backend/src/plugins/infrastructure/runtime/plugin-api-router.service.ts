import { Injectable, Logger, Inject } from '@nestjs/common'
import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { PluginRuntimeService } from './plugin-runtime.service'
import { PERMISSION_CHECKER } from '../../domain/services'
import type { IPermissionChecker } from '../../domain/services'
import { PluginPermissions } from '../../domain/entities/plugin-permission.entity'

@Injectable()
export class PluginApiRouterService {
  private readonly logger = new Logger(PluginApiRouterService.name)
  private router: Router

  constructor(
    private readonly pluginRuntime: PluginRuntimeService,
    @Inject(PERMISSION_CHECKER)
    private readonly permissionChecker: IPermissionChecker,
  ) {
    this.router = Router()
    this.setupRoutes()
  }

  private setupRoutes() {
    // Dynamic route registration will happen when plugins are activated
    this.router.use('/:pluginId/*', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const pluginId = req.params.pluginId
        const runtime = this.pluginRuntime.getRuntime(pluginId)

        if (!runtime) {
          return res.status(404).json({ error: 'Plugin not found or not active' })
        }

        // Extract route path (remove /api/plugins/{pluginId})
        const routePath = req.path.replace(`/${pluginId}`, '')

        // Check API permissions
        const permissions = PluginPermissions.fromManifest(
          runtime.plugin.manifest.permissions || {},
        )
        const hasPermission = this.permissionChecker.checkApiPermission(
          permissions,
          routePath,
          req.method,
        )

        if (!hasPermission) {
          return res.status(403).json({ error: 'Plugin does not have API permission' })
        }

        // Find matching route
        const route = runtime.apiRoutes.find(
          (r) => {
            // Simple path matching (can be enhanced with regex)
            const routeMatches = r.path === routePath || 
              r.path.replace(/\/$/, '') === routePath.replace(/\/$/, '')
            return routeMatches && r.method === req.method
          },
        )

        if (!route) {
          return res.status(404).json({ error: 'Route not found' })
        }

        const result = await route.handler(req, res)
        if (!res.headersSent) {
          res.json(result)
        }
      } catch (error) {
        this.logger.error(`Error executing plugin route:`, error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' })
        }
      }
    })
  }

  getRouter(): Router {
    return this.router
  }

  registerPluginRoutes(pluginId: string): void {
    const runtime = this.pluginRuntime.getRuntime(pluginId)
    if (!runtime) {
      return
    }

    // Routes are handled dynamically in setupRoutes
    // This method can be extended for more advanced routing
    this.logger.log(`Registered routes for plugin ${runtime.plugin.name}`)
  }
}
