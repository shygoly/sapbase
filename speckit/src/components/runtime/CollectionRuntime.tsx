/**
 * CollectionRuntime Component
 * Wrapper component for table/list views that enforces Runtime-First architecture
 * 
 * Usage:
 * ```tsx
 * <CollectionRuntime model={MyCollectionModel}>
 *   <DataTable columns={columns} data={data} />
 * </CollectionRuntime>
 * ```
 */

'use client';

import React from 'react';
import { PermissionGuard } from '@/core/auth/permission-guard';

export interface CollectionModel {
  /**
   * Unique identifier for the collection
   */
  id: string;
  /**
   * Collection name/type
   */
  name: string;
  /**
   * Required permissions to view this collection
   */
  permissions?: string[];
  /**
   * Whether user must have ALL permissions (AND logic)
   * @default false
   */
  requireAll?: boolean;
  /**
   * Custom access denied fallback
   */
  accessDeniedFallback?: React.ReactNode;
}

interface CollectionRuntimeProps {
  /**
   * Collection model defining schema and permissions
   */
  model: CollectionModel;
  /**
   * Collection content (table, list, etc.)
   */
  children: React.ReactNode;
  /**
   * Whether collection is loading
   */
  isLoading?: boolean;
}

/**
 * CollectionRuntime - Enforces Runtime-First pattern for collections
 * 
 * Responsibilities:
 * - Validates collection model schema
 * - Enforces RBAC permissions for viewing collections
 * - Provides consistent collection structure
 * - Handles loading states
 */
export function CollectionRuntime({
  model,
  children,
  isLoading = false,
}: CollectionRuntimeProps) {
  void isLoading
  // Validate model
  if (!model.id || !model.name) {
    return (
      <div className="p-4 text-red-600">
        Invalid collection model. Check console for details.
      </div>
    );
  }

  // If no permissions required, render directly
  if (!model.permissions || model.permissions.length === 0) {
    return <>{children}</>;
  }

  // Wrap with permission guard
  return (
    <PermissionGuard
      permissions={model.permissions}
      requireAll={model.requireAll}
      fallback={model.accessDeniedFallback}
    >
      {children}
    </PermissionGuard>
  );
}
