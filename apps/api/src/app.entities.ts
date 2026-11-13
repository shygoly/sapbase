/**
 * 组合根的实体清单（TypeORM DataSource.entities 的唯一来源）。
 *
 * 应用层只做装配：平台基座实体来自 `PLATFORM_CORE_ENTITIES`，其余模块各自
 * 导出实体类，统一在这里登记。新增业务域时把它自己的 `*.entities.ts`
 * 追加到这里（见 docs/architecture/add-a-domain.md）。
 */
import { PLATFORM_CORE_ENTITIES } from './platform-core.entities'
import { AgentConfirmationToken } from './agent-tools/confirmation-token.entity'
import { AppRoleBinding } from './app-catalog/entities/app-role-binding.entity'
import { AppBrandConfig } from './app-catalog/entities/app-brand-config.entity'
import { AppCapability } from './app-capabilities/entities/app-capability.entity'
import { AgentEvalCase } from './agent-eval/entities/agent-eval-case.entity'
import { AgentEvalRun } from './agent-eval/entities/agent-eval-run.entity'
import { AgentFeedback } from './agent-feedback/entities/agent-feedback.entity'
import { AgentFeedbackTopic } from './agent-feedback/entities/agent-feedback-topic.entity'
import { AgentKnowledgeEntry } from './agent-knowledge/entities/agent-knowledge-entry.entity'
import { AgentSkillVersion } from './agent-knowledge/entities/agent-skill-version.entity'
import { AgentConversation } from './agent-sessions/entities/agent-conversation.entity'
import { AgentDefinition } from './agent-sessions/entities/agent-definition.entity'
import { AgentInstance } from './agent-sessions/entities/agent-instance.entity'
import { AgentRun } from './agent-sessions/entities/agent-run.entity'
import { AgentStep } from './agent-sessions/entities/agent-step.entity'
import { AgentWait } from './agent-sessions/entities/agent-wait.entity'
import { AgentToolCall } from './agent-sessions/entities/agent-tool-call.entity'
import { AgentTurn } from './agent-sessions/entities/agent-turn.entity'
import { AIModel } from './ai-models/ai-model.entity'
import { AIModule } from './ai-modules/ai-module.entity'
import { AIModuleDefinition } from './ai-modules/ai-module-definition.entity'
import { AIModuleReview } from './ai-modules/ai-module-review.entity'
import { AIModuleVersion } from './ai-modules/ai-module-version.entity'
import { AIModuleTest } from './ai-modules/ai-module-test.entity'
import { BusinessAppInstallation } from './business-apps/business-app-installation.entity'
import { BusinessAppInstallationRevision } from './business-apps/business-app-installation-revision.entity'
import { MenuItem } from './menu/menu.entity'
import { ModuleCapability } from './module-registry/module-capability.entity'
import { ModuleConfiguration } from './module-registry/module-configuration.entity'
import { ModuleRegistry } from './module-registry/module-registry.entity'
import { ModuleRelationship } from './module-registry/module-relationship.entity'
import { ModuleStatistics } from './module-registry/module-statistics.entity'
import { NotificationRecord } from './notifications/notification.entity'
import { ReviewComment } from './review/review-comment.entity'
import { ReviewEvent } from './review/review-event.entity'
import { ReviewDelegation } from './review/review-delegation.entity'
import { WorkItem } from './review/work-item.entity'
import { NotificationPreference } from './notifications/notification-preference.entity'
import { Announcement } from './notifications/announcement.entity'
import { AnnouncementAudience } from './notifications/announcement-audience.entity'
import { AnnouncementDelivery } from './notifications/announcement-delivery.entity'
import { NotificationCleanupRun } from './notifications/notification-cleanup-run.entity'
import { SearchDocument } from './search/search-document.entity'
import { RecordSnapshot } from './record-lifecycle/record-snapshot.entity'
import { RecordOperation } from './record-lifecycle/record-operation.entity'
import { AiContentProvenance, AiContentLabel, AiScoreRecord } from './ai-governance/ai-governance.entities'
import { MetricDefinition, MetricValue, Dashboard, DashboardWidget, MetricAlert, MetricAlertEvent } from './metrics/metrics.entities'
import { OfflinePackage, OfflineEntitlement, OfflineDevice } from './offline/offline.entities'
import { DocumentParseRun, DocumentSection, DocumentCandidate } from './document-intelligence/document.entities'
import { ImportRun, ExportRun, ImportMapping } from './bulk/bulk.entities'
import { IntegrationConnector, OutboundMessage, WebhookEndpoint, WebhookEvent, DataSource, DataSyncJob, DataSyncRun } from './integrations/integrations.entities'
import { OutboxDelivery } from './outbox/outbox-delivery.entity'
import { OutboxEvent } from './outbox/outbox-event.entity'
import { Plugin as PluginOrm } from './plugins/infrastructure/persistence/plugin.entity'
import { ReleaseAutomationPolicy } from './release-automation/entities/release-automation-policy.entity'
import { ReleaseAutomationRun } from './release-automation/entities/release-automation-run.entity'
import {
  AppChangeProposal,
  AppDraft,
  AppRelease,
  AppReleaseActivation,
  AppReleaseApproval,
  AppReleaseEvent,
  AppReleaseItem,
  AppUserReleaseView,
  AppReleaseTestEvidence,
} from './releases/entities'
import { BlueprintApproval } from './semantic-runtime/blueprint-approval.entity'
import { BlueprintDocCounter } from './semantic-runtime/blueprint-doc-counter.entity'
import { BlueprintJournalEntry } from './semantic-runtime/blueprint-journal-entry.entity'
import { BlueprintRecord } from './semantic-runtime/blueprint-record.entity'
import { BlueprintSuggestionLog } from './semantic-runtime/suggestion-log.entity'
import { WorkflowAutoSuggestionLog } from './workflow-archive/workflow-auto-suggestion-log.entity'
import { WorkflowDefinition } from './workflow-archive/workflow-definition.entity'
import { WorkflowHistory } from './workflow-archive/workflow-history.entity'
import { WorkflowInstance } from './workflow-archive/workflow-instance.entity'

export const APP_ENTITIES = [
  ...PLATFORM_CORE_ENTITIES,
  MenuItem,
  AIModel,
  AIModule,
  AIModuleTest,
  AIModuleReview,
  AIModuleVersion,
  AIModuleDefinition,
  ModuleRegistry,
  ModuleRelationship,
  ModuleCapability,
  ModuleStatistics,
  ModuleConfiguration,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowHistory,
  WorkflowAutoSuggestionLog,
  PluginOrm,
  BlueprintRecord,
  BlueprintSuggestionLog,
  BlueprintDocCounter,
  BlueprintApproval,
  BlueprintJournalEntry,
  OutboxEvent,
  OutboxDelivery,
  NotificationRecord,
  ReviewComment,
  ReviewEvent,
  ReviewDelegation,
  WorkItem,
  NotificationPreference,
  Announcement,
  AnnouncementAudience,
  AnnouncementDelivery,
  NotificationCleanupRun,
  SearchDocument,
  RecordSnapshot,
  RecordOperation,
  AiContentProvenance,
  AiContentLabel,
  AiScoreRecord,
  MetricDefinition,
  MetricValue,
  Dashboard,
  DashboardWidget,
  MetricAlert,
  MetricAlertEvent,
  OfflinePackage,
  OfflineEntitlement,
  OfflineDevice,
  DocumentParseRun,
  DocumentSection,
  DocumentCandidate,
  ImportRun,
  ExportRun,
  ImportMapping,
  IntegrationConnector,
  OutboundMessage,
  WebhookEndpoint,
  WebhookEvent,
  DataSource,
  DataSyncJob,
  DataSyncRun,
  AgentConfirmationToken,
  AppRoleBinding,
  AppBrandConfig,
  AppCapability,
  BusinessAppInstallation,
  BusinessAppInstallationRevision,
  AppDraft,
  AppChangeProposal,
  AppRelease,
  AppReleaseItem,
  AppReleaseActivation,
  AppReleaseApproval,
  AppReleaseEvent,
  AppUserReleaseView,
  AppReleaseTestEvidence,
  AgentConversation,
  AgentDefinition,
  AgentInstance,
  AgentRun,
  AgentStep,
  AgentWait,
  AgentTurn,
  AgentToolCall,
  AgentKnowledgeEntry,
  AgentSkillVersion,
  AgentEvalCase,
  AgentEvalRun,
  AgentFeedback,
  AgentFeedbackTopic,
  ReleaseAutomationPolicy,
  ReleaseAutomationRun,
]
