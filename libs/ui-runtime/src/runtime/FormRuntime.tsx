/**
 * FormRuntime Component
 * Wrapper component for forms that enforces Runtime-First architecture
 *
 * Usage:
 * ```tsx
 * <FormRuntime model={MyFormModel} draftKey="customer:new" draftValue={values} onDraftRestore={setValues} isDirty={isDirty}>
 *   <Form>...</Form>
 * </FormRuntime>
 * ```
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { PermissionGuard } from '../core/auth/permission-guard';
import { RuntimeAccessProvider, type RuntimeAccessModel } from './runtime-access';

const DEFAULT_MAX_DRAFT_BYTES = 256 * 1024;

export interface FormModel extends RuntimeAccessModel {
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
  /** 草稿键；提供后自动读写 localStorage。 */
  draftKey?: string;
  /** 当前草稿值（通常是表单 state）。 */
  draftValue?: unknown;
  /** 从草稿恢复时回调。 */
  onDraftRestore?: (value: unknown) => void;
  /** 是否有未保存修改；用于离开页面提示。 */
  isDirty?: boolean;
  /** 草稿体积上限（默认 256KB）。 */
  maxDraftBytes?: number;
  /** 提交成功后由页面调用以清理草稿。 */
  clearDraftSignal?: number;
}

interface FormRuntimePropsInternal extends FormRuntimeProps {
  __accessProvider?: boolean;
}

/**
 * FormRuntime - Enforces Runtime-First pattern for forms
 *
 * Responsibilities:
 * - Validates form model schema
 * - Enforces RBAC permissions for form access
 * - Provides consistent form structure
 * - Handles loading states
 * - Draft persistence with size limit + leave guard
 */
export function FormRuntime({
  model,
  children,
  isLoading = false,
  draftKey,
  draftValue,
  onDraftRestore,
  isDirty = false,
  maxDraftBytes = DEFAULT_MAX_DRAFT_BYTES,
  clearDraftSignal,
}: FormRuntimePropsInternal) {
  void isLoading;
  const restored = useRef(false);

  const storageKey = draftKey ? `sap:draft:${draftKey}` : null;

  useEffect(() => {
    if (!storageKey || restored.current) return;
    restored.current = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      if (raw.length > maxDraftBytes) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      onDraftRestore?.(JSON.parse(raw));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey, maxDraftBytes, onDraftRestore]);

  useEffect(() => {
    if (!storageKey || draftValue === undefined) return;
    try {
      const serialized = JSON.stringify(draftValue);
      if (serialized.length <= maxDraftBytes) {
        window.localStorage.setItem(storageKey, serialized);
      }
    } catch {
      // 不可序列化/超额时不写草稿；不阻塞表单。
    }
  }, [storageKey, draftValue, maxDraftBytes]);

  useEffect(() => {
    if (!storageKey || clearDraftSignal === undefined) return;
    window.localStorage.removeItem(storageKey);
  }, [storageKey, clearDraftSignal]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  if (!model.id || !model.name) {
    return (
      <div className="p-4 text-red-600">
        Invalid form model. Check console for details.
      </div>
    );
  }

  const content = (
    <RuntimeAccessProvider model={model}>{children}</RuntimeAccessProvider>
  );

  if (!model.permissions || model.permissions.length === 0) {
    return content;
  }

  return (
    <PermissionGuard
      permissions={model.permissions}
      requireAll={model.requireAll}
      fallback={model.accessDeniedFallback}
    >
      {content}
    </PermissionGuard>
  );
}

/** 页面级离开守卫：dirty 时拦截同页链接点击/关闭。 */
export function useLeaveGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || anchor.getAttribute('target') === '_blank') return;
      if (!window.confirm('有未保存修改，确定离开？')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isDirty]);
}
