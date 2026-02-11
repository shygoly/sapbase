'use client';

import { ReactNode } from 'react';

export interface FormSchema {
  id: string;
  title: string;
  fields: Array<{
    name: string;
    type: string;
    label: string;
    required?: boolean;
    validation?: Record<string, any>;
  }>;
}

export interface FormRuntimeProps {
  /**
   * Form schema defining fields and validation
   */
  schema: FormSchema;

  /**
   * Form content
   */
  children: ReactNode;

  /**
   * Optional CSS class
   */
  className?: string;
}

/**
 * FormRuntime Component
 *
 * Enforces schema-first form development by requiring a FormSchema.
 * All forms must use this component to ensure consistent validation,
 * error handling, and state management.
 *
 * Usage:
 * ```tsx
 * const formSchema: FormSchema = {
 *   id: 'user-form',
 *   title: 'User Form',
 *   fields: [
 *     {
 *       name: 'email',
 *       type: 'email',
 *       label: 'Email',
 *       required: true,
 *       validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
 *     }
 *   ]
 * };
 *
 * export default function UserForm() {
 *   return (
 *     <FormRuntime schema={formSchema}>
 *       <FormFields />
 *     </FormRuntime>
 *   );
 * }
 * ```
 */
export function FormRuntime({
  schema,
  children,
  className,
}: FormRuntimeProps) {
  // TODO: Implement schema validation
  // TODO: Implement field rendering
  // TODO: Implement error handling
  // TODO: Implement submission handling

  // Note: This is intentionally a div wrapper to avoid nested <form>
  // when used with SchemaForm or other form components that render
  // their own <form> elements.
  return (
    <div className={className} data-form-id={schema.id}>
      {children}
    </div>
  );
}
