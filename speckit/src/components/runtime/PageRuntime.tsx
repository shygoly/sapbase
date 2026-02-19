/**
 * PageRuntime Component
 * Wrapper component that enforces Runtime-First architecture for pages
 * 
 * Usage:
 * ```tsx
 * <PageRuntime model={MyPageModel}>
 *   <MyPageContent />
 * </PageRuntime>
 * ```
 */

'use client';

import React from 'react';
import { PermissionGuard } from '@/core/auth/permission-guard';
import PageContainer from '@/components/layout/page-container';

export interface PageModel {
  /**
   * Unique identifier for the page
   */
  id: string;
  /**
   * Page title
   */
  title: string;
  /**
   * Page description
   */
  description?: string;
  /**
   * Required permissions to access this page
   * User must have at least one permission (OR logic)
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

interface PageRuntimeProps {
  /**
   * Page model defining schema and permissions
   */
  model: PageModel;
  /**
   * Page content
   */
  children: React.ReactNode;
  /**
   * Whether page is loading
   */
  isLoading?: boolean;
  /**
   * Custom page header action
   */
  pageHeaderAction?: React.ReactNode;
}

/**
 * PageRuntime - Enforces Runtime-First pattern for pages
 * 
 * Responsibilities:
 * - Validates page model schema
 * - Enforces RBAC permissions
 * - Provides consistent page structure
 * - Handles loading states
 */
export function PageRuntime({
  model,
  children,
  isLoading = false,
  pageHeaderAction,
}: PageRuntimeProps) {
  // Validate model
  if (!model.id || !model.title) {
    return (
      <div className="p-4 text-red-600">
        Invalid page model. Check console for details.
      </div>
    );
  }

  // If no permissions required, render directly
  if (!model.permissions || model.permissions.length === 0) {
    return (
      <PageContainer
        pageTitle={model.title}
        pageDescription={model.description}
        isloading={isLoading}
        pageHeaderAction={pageHeaderAction}
      >
        {children}
      </PageContainer>
    );
  }

  // Wrap with permission guard
  return (
    <PermissionGuard
      permissions={model.permissions}
      requireAll={model.requireAll}
      fallback={model.accessDeniedFallback}
    >
      <PageContainer
        pageTitle={model.title}
        pageDescription={model.description}
        isloading={isLoading}
        pageHeaderAction={pageHeaderAction}
      >
        {children}
      </PageContainer>
    </PermissionGuard>
  );
}
