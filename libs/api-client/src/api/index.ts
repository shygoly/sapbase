/**
 * Export all API services
 */

export { dataScopeApi, type ScopeDimension, type ScopeNode, type ScopeMembership, type ScopeBinding, type DataPolicy, type ScopePreview } from './data-scope.api'
export { authApi } from './auth.api'
export { menuApi } from './menu.api'
export { usersApi } from './users.api'
export { rolesApi } from './roles.api'
export { departmentsApi } from './departments.api'
export {
  jobsApi,
  type Job,
  type JobEvent,
  type JobStatus,
  type CreateJobInput,
  type JobListResult,
} from './jobs.api'
export { permissionsApi } from './permissions.api'
export { auditLogsApi } from './audit-logs.api'
export { settingsApi } from './settings.api'
export { aiModelsApi } from './ai-models.api'
export { aiModulesApi } from './ai-modules.api'
export { moduleRegistryApi } from './module-registry.api'
export { pluginsApi } from './plugins.api'
export { atomicApi } from './atomic.api'
export { systemApi } from './system.api'
export { chatApi } from './chat.api'
export { agentToolsApi } from './agent-tools.api'
export { businessAppsApi } from './business-apps.api'
export {
  notificationsApi,
  type NotificationItem,
  type NotificationPreference,
  type NotificationCategory,
  type NotificationPriority,
} from './notifications.api'
export {
  announcementsApi,
  type Announcement,
  type AnnouncementStatus,
  type AnnouncementAudienceInput,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
  type AnnouncementStats,
  type AnnouncementAttachment,
  type AnnouncementDelivery,
  type AnnouncementDeliveryPage,
  type AnnouncementPublishResult,
} from './announcements.api'
export { dashboardApi, type DashboardSummary } from './dashboard.api'
export { constantsApi } from './shipping/constants.api'
export { apiClient, httpClient } from './client'

// Export types
export * from './types'
