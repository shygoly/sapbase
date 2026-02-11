/**
 * DetailRuntime Component
 * Wrapper component for detail views that enforces Runtime-First architecture
 * 
 * Usage:
 * ```tsx
 * <DetailRuntime model={MyDetailModel}>
 *   <DetailView data={data} />
 * </DetailRuntime>
 * ```
 */

'use client';

import React from 'react';
import { PermissionGuard } from '@/core/auth/permission-guard';

export interface DetailModel {
  /**
   * Unique identifier for the detail view
   */
  id: string;
  /**
   * Detail view name/type
   */
  name: string;
  /**
   * Required permissions to view this detail
   * Typically 'resource:read'
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

interface DetailRuntimeProps {
  /**
   * Detail model defining schema and permissions
   */
  model: DetailModel;
  /**
   * Detail view content
   */
  children: React.ReactNode;
  /**
   * Whether detail view is loading
   */
  isLoading?: boolean;
}

/**
 * DetailRuntime - Enforces Runtime-First pattern for detail views
 * 
 * Responsibilities:
 * - Validates detail model schema
 * - Enforces RBAC permissions for viewing details
 * - Provides consistent detail view structure
 * - Handles loading states
 */
export function DetailRuntime({
  model,
  children,
  isLoading = false,
}: DetailRuntimeProps) {
  // Validate model
  if (!model.id || !model.name) {
    console.error('DetailRuntime: Invalid detail model. Must have id and name.');
    return (
      <div className="p-4 text-red-600">
        Invalid detail model. Check console for details.
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
