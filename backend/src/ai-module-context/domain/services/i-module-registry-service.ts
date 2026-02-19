/**
 * Port for module registry service (implemented in infrastructure).
 */
export interface IModuleRegistryService {
  registerModule(moduleId: string, module: {
    name: string
    description: string | null
    version: string
    patchContent: Record<string, any>
    organizationId: string
  }): Promise<string> // returns registry module ID
  unregisterModule(moduleId: string, organizationId: string): Promise<void>
  updateModuleRegistry(registryModuleId: string, aiModuleId: string, organizationId: string): Promise<void>
}
