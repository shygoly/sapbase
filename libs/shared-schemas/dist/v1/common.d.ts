/**
 * Common types and enums shared across Speckit ERP
 */
export declare enum EntityStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    ARCHIVED = "archived"
}
export declare enum UserStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    SUSPENDED = "suspended"
}
export declare enum AuditAction {
    CREATE = "CREATE",
    READ = "READ",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    LOGIN = "LOGIN",
    LOGOUT = "LOGOUT"
}
export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface BaseAuditEntity extends BaseEntity {
    createdBy?: string;
    updatedBy?: string;
}
export interface PaginationParams {
    page: number;
    limit: number;
    offset?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface ApiResponse<T> {
    data: T;
    status: number;
    message?: string;
}
export interface ApiErrorResponse {
    status: number;
    message: string;
    error?: string;
    details?: Record<string, any>;
}
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute';
export type PermissionResource = 'users' | 'roles' | 'departments' | 'settings' | 'audit-logs';
export type PermissionString = `${PermissionResource}:${PermissionAction}`;
