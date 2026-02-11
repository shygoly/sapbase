import type { ObjectSchema, ResolvedPageSchema } from '@/core/schema/types';
import type { PageModel, PageType } from '@/core/page-model/types';
import type { CollectionSchema } from './collection-runtime';
import type { FormSchema } from './form-runtime';

function resolvePageType(pageSchema?: ResolvedPageSchema): PageType {
  if (!pageSchema) return 'list';
  if (pageSchema.type === 'dashboard') return 'dashboard';
  if (pageSchema.type === 'form') return 'form';
  if (pageSchema.type === 'detail') return 'detail';
  return 'list';
}

export function buildPageModel(options: {
  id: string;
  path: string;
  fallbackTitle: string;
  fallbackDescription?: string;
  pageSchema?: ResolvedPageSchema | null;
}): PageModel {
  const { id, path, fallbackTitle, fallbackDescription, pageSchema } = options;

  return {
    id,
    path,
    type: resolvePageType(pageSchema ?? undefined),
    title: pageSchema?.metadata?.title || fallbackTitle,
    description: pageSchema?.metadata?.description || fallbackDescription,
    metadata: pageSchema?.metadata,
  };
}

export function toCollectionSchema(
  objectSchema: ObjectSchema,
  pageSchema?: ResolvedPageSchema | null,
): CollectionSchema {
  const fields = objectSchema.fields.filter((field) => !field.hidden);

  return {
    id: `${objectSchema.name}-collection`,
    title: objectSchema.label,
    columns: fields.map((field) => ({
      id: field.name,
      label: field.label,
      type: field.type,
      sortable: true,
      filterable: true,
    })),
    actions: pageSchema?.actions?.map((action) => ({
      id: action.name,
      label: action.label,
      type: action.type,
    })),
  };
}

export function toFormSchema(objectSchema: ObjectSchema): FormSchema {
  const fields = objectSchema.fields.filter((field) => !field.hidden);

  return {
    id: `${objectSchema.name}-form`,
    title: objectSchema.label,
    fields: fields.map((field) => ({
      name: field.name,
      type: field.type,
      label: field.label,
      required: field.required,
      validation: field.validation ? { rules: field.validation } : undefined,
    })),
  };
}
