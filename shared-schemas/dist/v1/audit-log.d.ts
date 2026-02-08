/**
 * Audit Log schema definitions
 */
import { BaseEntity, AuditAction } from './common';
export interface AuditLog extends BaseEntity {
    userId: string;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    changes?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    status: 'success' | 'failure';
    errorMessage?: string;
}
export interface CreateAuditLogInput {
    userId: string;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    changes?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    status: 'success' | 'failure';
    errorMessage?: string;
}
export interface AuditLogFilter {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: 'success' | 'failure';
}
