/**
 * Domain event: an AI module was registered in the module registry.
 */
export class ModuleRegisteredEvent {
  constructor(
    public readonly moduleId: string,
    public readonly organizationId: string,
    public readonly registryModuleId: string,
    public readonly registeredAt: Date,
  ) {}
}
