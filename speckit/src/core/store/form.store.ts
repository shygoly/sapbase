import { create } from 'zustand'

export interface FormState {
  [formId: string]: {
    values: Record<string, any>
    errors: Record<string, string>
    touched: Record<string, boolean>
    isDirty: boolean
    isSubmitting: boolean
    submitCount: number
  }
}

export interface FormStoreState {
  forms: FormState

  // Actions
  initializeForm: (formId: string, initialValues: Record<string, any>) => void
  setFieldValue: (formId: string, fieldName: string, value: any) => void
  setFieldError: (formId: string, fieldName: string, error: string) => void
  setFieldTouched: (formId: string, fieldName: string, touched: boolean) => void
  setFormErrors: (formId: string, errors: Record<string, string>) => void
  setFormValues: (formId: string, values: Record<string, any>) => void
  setSubmitting: (formId: string, isSubmitting: boolean) => void
  incrementSubmitCount: (formId: string) => void
  resetForm: (formId: string, initialValues?: Record<string, any>) => void
  removeForm: (formId: string) => void
}

export const useFormStore = create<FormStoreState>((set) => ({
  forms: {},

  initializeForm: (formId, initialValues) =>
    set((state) => ({
      forms: {
        ...state.forms,
        [formId]: {
          values: initialValues,
          errors: {},
          touched: {},
          isDirty: false,
          isSubmitting: false,
          submitCount: 0,
        },
      },
    })),

  setFieldValue: (formId, fieldName, value) =>
    set((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        forms: {
          ...state.forms,
          [formId]: {
            ...form,
            values: { ...form.values, [fieldName]: value },
            isDirty: true,
          },
        },
      }
    }),

  setFieldError: (formId, fieldName, error) =>
    set((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        forms: {
          ...state.forms,
          [formId]: {
            ...form,
            errors: { ...form.errors, [fieldName]: error },
          },
        },
      }
    }),

  setFieldTouched: (formId, fieldName, touched) =>
    set((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        forms: {
          ...state.forms,
          [formId]: {
            ...form,
            touched: { ...form.touched, [fieldName]: touched },
          },
        },
      }
    }),

  setFormErrors: (formId, errors) =>
    set((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        forms: {
          ...state.forms,
          [formId]: { ...form, errors },
        },
      }
    }),

  setFormValues: (formId, values) =>
    set((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        forms: {
          ...state.forms,
          [formId]: { ...form, values, isDirty: true },
        },
      }
    }),

  setSubmitting: (formId, isSubmitting) =>
    set((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        forms: {
          ...state.forms,
          [formId]: { ...form, isSubmitting },
        },
      }
    }),

  incrementSubmitCount: (formId) =>
    set((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        forms: {
          ...state.forms,
          [formId]: { ...form, submitCount: form.submitCount + 1 },
        },
      }
    }),

  resetForm: (formId, initialValues) =>
    set((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        forms: {
          ...state.forms,
          [formId]: {
            values: initialValues || form.values,
            errors: {},
            touched: {},
            isDirty: false,
            isSubmitting: false,
            submitCount: 0,
          },
        },
      }
    }),

  removeForm: (formId) =>
    set((state) => {
      const { [formId]: _, ...rest } = state.forms
      return { forms: rest }
    }),
}))
