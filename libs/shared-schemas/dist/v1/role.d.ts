/**
 * Role schema definitions
 */
import { BaseAuditEntity, EntityStatus } from './common';
export interface Role extends BaseAuditEntity {
    name: string;
    description?: string;
    permissions: string[];
    status: EntityStatus;
}
export interface CreateRoleInput {
    name: string;
    description?: string;
    permissions?: string[];
    status?: EntityStatus;
}
export interface UpdateRoleInput {
    name?: string;
    description?: string;
    permissions?: string[];
    status?: EntityStatus;
}
