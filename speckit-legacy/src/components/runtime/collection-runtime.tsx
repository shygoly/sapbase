'use client';

import { ReactNode } from 'react';

export interface CollectionSchema {
  id: string;
  title: string;
  columns: Array<{
    id: string;
    label: string;
    type: string;
    sortable?: boolean;
    filterable?: boolean;
  }>;
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'danger';
  }>;
}

export interface CollectionRuntimeProps {
  /**
   * Collection schema defining columns and actions
   */
  schema: CollectionSchema;

  /**
   * Collection content
   */
  children: ReactNode;

  /**
   * Optional CSS class
   */
  className?: string;

  /**
   * Optional data source
   */
  data?: Array<Record<string, any>>;

  /**
   * Optional loading state
   */
  isLoading?: boolean;
}

/**
 * CollectionRuntime Component
 *
 * Enforces schema-first collection/list development by requiring a CollectionSchema.
 * All data tables and lists must use this component to ensure consistent column
 * definitions, sorting, filtering, and action handling.
 *
 * Usage:
 * ```tsx
 * const collectionSchema: CollectionSchema = {
 *   id: 'users-table',
 *   title: 'Users',
 *   columns: [
 *     { id: 'email', label: 'Email', type: 'text', sortable: true, filterable: true },
 *     { id: 'role', label: 'Role', type: 'select', sortable: true, filterable: true }
 *   ],
 *   actions: [
 *     { id: 'edit', label: 'Edit', type: 'primary' },
 *     { id: 'delete', label: 'Delete', type: 'danger' }
 *   ]
 * };
 *
 * export default function UsersTable() {
 *   return (
 *     <CollectionRuntime schema={collectionSchema} data={users}>
 *       <DataTable />
 *     </CollectionRuntime>
 *   );
 * }
 * ```
 */
export function CollectionRuntime({
  schema,
  children,
  className,
  data,
  isLoading,
}: CollectionRuntimeProps) {
  // TODO: Implement schema validation
  // TODO: Implement column rendering
  // TODO: Implement sorting
  // TODO: Implement filtering
  // TODO: Implement action handling

  return (
    <div className={className} data-collection-id={schema.id}>
      {children}
    </div>
  );
}
