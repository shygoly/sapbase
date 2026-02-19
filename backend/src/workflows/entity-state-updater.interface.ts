/**
 * Abstraction for updating entity state when a workflow transition completes.
 * Modules can register an updater per entityType so that transition engine
 * can write back the new state to the entity record.
 */
export interface IEntityStateUpdater {
  /**
   * Update the entity's state field(s).
   * @param entityId - Entity record id
   * @param updates - Key-value updates (e.g. { state: 'qualified' } or { status: 'won' })
   * @param organizationId - Tenant context
   */
  update(
    entityId: string,
    updates: Record<string, any>,
    organizationId: string,
  ): Promise<any>
}
