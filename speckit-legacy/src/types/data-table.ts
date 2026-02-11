/**
 * Data Table Types
 * Types for advanced data table functionality
 */

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'gt'
  | 'lte'
  | 'gte'
  | 'isBetween'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'inArray'
  | 'notInArray'
  | 'iLike'
  | 'notILike'
  | 'isRelativeToToday';

export type FilterVariant =
  | 'text'
  | 'number'
  | 'date'
  | 'dateRange'
  | 'select'
  | 'multiSelect'
  | 'boolean'
  | 'range';

export interface ExtendedColumnFilter<TData = any> {
  id: string;
  operator: FilterOperator;
  value: unknown;
  variant?: FilterVariant;
}

export interface ExtendedColumnSort<TData = any> {
  id: string;
  desc: boolean;
}

export interface DataTableConfig {
  pageSize: number;
  maxPageSize: number;
  defaultSort?: ExtendedColumnSort[];
  defaultFilters?: ExtendedColumnFilter[];
  textOperators?: { label: string; value: FilterOperator }[];
  numericOperators?: { label: string; value: FilterOperator }[];
  dateOperators?: { label: string; value: FilterOperator }[];
  booleanOperators?: { label: string; value: FilterOperator }[];
  selectOperators?: { label: string; value: FilterOperator }[];
  multiSelectOperators?: { label: string; value: FilterOperator }[];
}

export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

// Extend ColumnMeta to support custom properties
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    options?: Option[];
    unit?: string;
    range?: [number, number];
  }
}
