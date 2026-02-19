/**
 * Injection tokens for repository ports (used by Nest DI).
 */
export const USER_REPOSITORY = Symbol('IUserRepository')
export const ORGANIZATION_REPOSITORY = Symbol('IOrganizationRepository')
export const EVENT_PUBLISHER = Symbol('IEventPublisher')
