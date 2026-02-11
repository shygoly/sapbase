export class AuditLogResponseDto {
  id: string
  action: string
  resource: string
  actor: string
  status: 'success' | 'failure' | 'pending'
  resourceId?: string
  changes?: Record<string, any>
  metadata?: Record<string, any>
  timestamp: Date
}
