/**
 * Injection tokens for repository and event ports (used by Nest DI).
 */
export const ORGANIZATION_REPOSITORY = Symbol('IOrganizationRepository')
export const ORGANIZATION_MEMBER_REPOSITORY = Symbol(
  'IOrganizationMemberRepository',
)
export const INVITATION_REPOSITORY = Symbol('IInvitationRepository')
export const BRAND_CONFIG_REPOSITORY = Symbol('IBrandConfigRepository')
export const EVENT_PUBLISHER = Symbol('IEventPublisher')
