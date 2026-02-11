'use client';

import { ReactNode } from 'react';
import { PageModel } from '@/core/page-model/types';

export interface PageRuntimeProps {
  /**
   * Page model defining the page structure and behavior
   */
  model: PageModel;

  /**
   * Page content
   */
  children: ReactNode;

  /**
   * Optional CSS class
   */
  className?: string;
}

/**
 * PageRuntime Component
 *
 * Enforces Runtime-First architecture by requiring a PageModel.
 * All pages must use this component to ensure consistent behavior,
 * permissions checking, and state management.
 *
 * Usage:
 * ```tsx
 * const pageModel: PageModel = {
 *   id: 'users-list',
 *   title: 'Users',
 *   permissions: ['users:read'],
 *   // ... other model properties
 * };
 *
 * export default function UsersPage() {
 *   return (
 *     <PageRuntime model={pageModel}>
 *       <UsersList />
 *     </PageRuntime>
 *   );
 * }
 * ```
 */
export function PageRuntime({
  model,
  children,
  className,
}: PageRuntimeProps) {
  // TODO: Implement page model validation
  // TODO: Implement permission checking
  // TODO: Implement state machine initialization
  // TODO: Implement breadcrumb generation

  return (
    <div className={className} data-page-id={model.id}>
      {children}
    </div>
  );
}
