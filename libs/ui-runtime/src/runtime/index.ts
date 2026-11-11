/**
 * Runtime Components
 * Export all Runtime wrapper components for Runtime-First architecture
 */

export { PageRuntime, type PageModel } from './PageRuntime';
export { CollectionRuntime, type CollectionModel } from './CollectionRuntime';
export { FormRuntime, type FormModel } from './FormRuntime';
export { DetailRuntime, type DetailModel } from './DetailRuntime';
export { useRuntimeSchema, type RuntimeSchemaState } from './use-runtime-schema';
export {
  RuntimeAccessProvider,
  useRuntimeAccess,
  FieldGuard,
  ActionGuard,
  type AccessRule,
  type FieldAccessRule,
  type RuntimeAction,
  type RuntimeAccessModel,
} from './runtime-access';
export { useLeaveGuard } from './FormRuntime';
export { RuntimeErrorBoundary } from './RuntimeErrorBoundary';
export { resolveUiComponent, type ResolvedUiComponentKey } from './component-registry';
