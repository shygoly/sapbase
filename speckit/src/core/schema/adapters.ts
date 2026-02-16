import type { ResolvedPageSchema } from './types'
import type { PageModel } from '@/components/runtime/PageRuntime'
import type { CollectionModel } from '@/components/runtime/CollectionRuntime'
import type { FormModel } from '@/components/runtime/FormRuntime'

/**
 * Convert ResolvedPageSchema to PageModel for PageRuntime
 */
export function buildPageModelFromSchema(
  resolvedSchema: ResolvedPageSchema,
  options?: {
    id?: string
    fallbackTitle?: string
    fallbackDescription?: string
  }
): PageModel {
  return {
    id: options?.id || resolvedSchema.path,
    title: resolvedSchema.metadata?.title || options?.fallbackTitle || resolvedSchema.path,
    description: resolvedSchema.metadata?.description || options?.fallbackDescription,
    permissions: resolvedSchema.permissions
      .filter(p => p.field === '*' && p.action === 'view')
      .flatMap(p => p.permissions),
  }
}

/**
 * Convert ResolvedPageSchema to CollectionModel for CollectionRuntime
 */
export function buildCollectionModelFromSchema(
  resolvedSchema: ResolvedPageSchema,
  options?: {
    id?: string
    name?: string
  }
): CollectionModel {
  return {
    id: options?.id || `${resolvedSchema.path}-collection`,
    name: options?.name || resolvedSchema.path,
    permissions: resolvedSchema.permissions
      .filter(p => p.field === '*' && p.action === 'view')
      .flatMap(p => p.permissions),
  }
}

/**
 * Convert ResolvedPageSchema to FormModel for FormRuntime
 */
export function buildFormModelFromSchema(
  resolvedSchema: ResolvedPageSchema,
  options?: {
    id?: string
    name?: string
  }
): FormModel {
  const isCreate = resolvedSchema.path.includes('create')
  const permissionAction = isCreate ? 'create' : 'edit'
  
  return {
    id: options?.id || `${resolvedSchema.path}-form`,
    name: options?.name || resolvedSchema.path,
    permissions: resolvedSchema.permissions
      .filter(p => p.field === '*' && p.action === permissionAction)
      .flatMap(p => p.permissions),
  }
}
