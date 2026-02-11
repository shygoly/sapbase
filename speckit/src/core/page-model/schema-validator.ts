/**
 * Schema Validator
 * Validates PageModel schemas to enforce Runtime-First architecture
 */

import type { PageModel } from '@/components/runtime/PageRuntime';
import type { CollectionModel } from '@/components/runtime/CollectionRuntime';
import type { FormModel } from '@/components/runtime/FormRuntime';
import type { DetailModel } from '@/components/runtime/DetailRuntime';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate PageModel schema
 */
export function validatePageModel(model: PageModel): ValidationResult {
  const errors: string[] = [];

  if (!model.id) {
    errors.push('PageModel must have an id');
  }

  if (!model.title) {
    errors.push('PageModel must have a title');
  }

  if (model.permissions && !Array.isArray(model.permissions)) {
    errors.push('PageModel permissions must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate CollectionModel schema
 */
export function validateCollectionModel(model: CollectionModel): ValidationResult {
  const errors: string[] = [];

  if (!model.id) {
    errors.push('CollectionModel must have an id');
  }

  if (!model.name) {
    errors.push('CollectionModel must have a name');
  }

  if (model.permissions && !Array.isArray(model.permissions)) {
    errors.push('CollectionModel permissions must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate FormModel schema
 */
export function validateFormModel(model: FormModel): ValidationResult {
  const errors: string[] = [];

  if (!model.id) {
    errors.push('FormModel must have an id');
  }

  if (!model.name) {
    errors.push('FormModel must have a name');
  }

  if (model.permissions && !Array.isArray(model.permissions)) {
    errors.push('FormModel permissions must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate DetailModel schema
 */
export function validateDetailModel(model: DetailModel): ValidationResult {
  const errors: string[] = [];

  if (!model.id) {
    errors.push('DetailModel must have an id');
  }

  if (!model.name) {
    errors.push('DetailModel must have a name');
  }

  if (model.permissions && !Array.isArray(model.permissions)) {
    errors.push('DetailModel permissions must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Runtime-First Architecture Rules
 * 
 * These rules help enforce the Runtime-First pattern:
 * 
 * 1. All pages MUST define PageModel schema first
 * 2. All pages MUST use PageRuntime wrapper
 * 3. All tables MUST use CollectionRuntime wrapper
 * 4. All forms MUST use FormRuntime wrapper
 * 5. Direct JSX without PageModel is forbidden
 * 6. Direct component usage without Runtime is forbidden
 * 
 * Example:
 * ```tsx
 * // ✅ CORRECT - Schema-first with Runtime wrapper
 * const UsersPageModel: PageModel = {
 *   id: 'users-page',
 *   title: 'Users Management',
 *   permissions: ['users:read'],
 * };
 * 
 * export default function UsersPage() {
 *   return (
 *     <PageRuntime model={UsersPageModel}>
 *       <CollectionRuntime model={UsersCollectionModel}>
 *         <UsersTable />
 *       </CollectionRuntime>
 *     </PageRuntime>
 *   );
 * }
 * 
 * // ❌ WRONG - Direct component usage
 * export default function UsersPage() {
 *   return <UsersTable />; // Missing PageRuntime and CollectionRuntime
 * }
 * ```
 */
export const RUNTIME_FIRST_RULES = {
  PAGE_MODEL_REQUIRED: 'All pages must define PageModel schema first',
  PAGE_RUNTIME_REQUIRED: 'All pages must use PageRuntime wrapper',
  COLLECTION_RUNTIME_REQUIRED: 'All tables/lists must use CollectionRuntime wrapper',
  FORM_RUNTIME_REQUIRED: 'All forms must use FormRuntime wrapper',
  NO_DIRECT_JSX: 'Direct JSX without PageModel is forbidden',
  NO_DIRECT_COMPONENTS: 'Direct component usage without Runtime is forbidden',
} as const;
