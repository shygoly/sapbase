/**
 * FormRuntime Component
 * Wrapper component for forms that enforces Runtime-First architecture
 * 
 * Usage:
 * ```tsx
 * <FormRuntime model={MyFormModel}>
 *   <Form>
 *     <FormField name="email" />
 *   </Form>
 * </FormRuntime>
 * ```
 */

'use client';

import React from 'react';
import { PermissionGuard } from '@/core/auth/permission-guard';

export interface FormModel {
  /**
   * Unique identifier for the form
   */
  id: string;
  /**
   * Form name/type
   */
  name: string;
  /**
   * Required permissions to access this form
   * For create forms, use 'resource:create'
   * For edit forms, use 'resource:update'
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

interface FormRuntimeProps {
  /**
   * Form model defining schema and permissions
   */
  model: FormModel;
  /**
   * Form content
   */
  children: React.ReactNode;
  /**
   * Whether form is loading
   */
  isLoading?: boolean;
}

/**
 * FormRuntime - Enforces Runtime-First pattern for forms
 * 
 * Responsibilities:
 * - Validates form model schema
 * - Enforces RBAC permissions for form access
 * - Provides consistent form structure
 * - Handles loading states
 */
export function FormRuntime({
  model,
  children,
  isLoading = false,
}: FormRuntimeProps) {
  // Validate model
  if (!model.id || !model.name) {
    console.error('FormRuntime: Invalid form model. Must have id and name.');
    return (
      <div className="p-4 text-red-600">
        Invalid form model. Check console for details.
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
