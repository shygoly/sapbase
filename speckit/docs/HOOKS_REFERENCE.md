# Custom Hooks Reference

## Overview

This document provides a reference for all custom hooks available in the Speckit ERP Frontend Runtime. These hooks simplify common patterns and integrate with system-level capabilities.

## Data Fetching Hooks

### useCache

Caches data with TTL (time-to-live) support.

```typescript
import { useCache } from '@/lib/hooks'

const { data, loading, error, revalidate } = useCache(
  'users',
  () => fetchUsers(),
  { ttl: 5 * 60 * 1000 } // 5 minutes
)
```

**Parameters:**
- `key`: Cache key identifier
- `fetcher`: Async function to fetch data
- `options.ttl`: Time to live in milliseconds
- `options.revalidateOnMount`: Force revalidation on mount

**Returns:**
- `data`: Cached data or null
- `loading`: Loading state
- `error`: Error object or null
- `revalidate`: Function to manually revalidate

### useFetch

Fetches data from a URL with automatic error handling.

```typescript
import { useFetch } from '@/lib/hooks'

const { data, loading, error, refetch } = useFetch('/api/users', {
  immediate: true,
  onSuccess: (data) => console.log('Loaded:', data),
  onError: (error) => console.error('Failed:', error),
})
```

**Parameters:**
- `url`: API endpoint URL
- `options`: Fetch options + custom handlers

**Returns:**
- `data`: Fetched data or null
- `loading`: Loading state
- `error`: Error object or null
- `refetch`: Function to manually refetch

## Form Hooks

### useForm

Manages form state, validation, and submission.

```typescript
import { useForm } from '@/lib/hooks'

const { values, errors, loading, handleChange, handleSubmit, reset } = useForm(
  { name: '', email: '' },
  async (values) => {
    await submitForm(values)
  },
  (values) => {
    const errors = {}
    if (!values.name) errors.name = 'Name is required'
    return errors
  }
)

return (
  <form onSubmit={handleSubmit}>
    <input name="name" value={values.name} onChange={handleChange} />
    {errors.name && <span>{errors.name}</span>}
    <button type="submit" disabled={loading}>Submit</button>
  </form>
)
```

**Parameters:**
- `initialValues`: Initial form values
- `onSubmit`: Async submit handler
- `validate`: Optional validation function

**Returns:**
- `values`: Current form values
- `errors`: Validation errors
- `loading`: Submission loading state
- `handleChange`: Input change handler
- `handleSubmit`: Form submit handler
- `reset`: Reset form to initial state
- `setValues`: Manually set values
- `setErrors`: Manually set errors

## State Management Hooks

### useToggle

Manages boolean toggle state.

```typescript
import { useToggle } from '@/lib/hooks'

const { value, toggle, setTrue, setFalse } = useToggle(false)

return (
  <div>
    <p>State: {value ? 'ON' : 'OFF'}</p>
    <button onClick={toggle}>Toggle</button>
    <button onClick={setTrue}>Turn On</button>
    <button onClick={setFalse}>Turn Off</button>
  </div>
)
```

**Returns:**
- `value`: Current boolean value
- `toggle`: Toggle the value
- `setTrue`: Set to true
- `setFalse`: Set to false
- `setValue`: Set to specific value

### useModal

Manages modal/dialog open/close state.

```typescript
import { useModal } from '@/lib/hooks'

const { isOpen, open, close, toggle } = useModal(false)

return (
  <>
    <button onClick={open}>Open Modal</button>
    {isOpen && (
      <div>
        <h2>Modal Content</h2>
        <button onClick={close}>Close</button>
      </div>
    )}
  </>
)
```

**Returns:**
- `isOpen`: Modal open state
- `open`: Open modal
- `close`: Close modal
- `toggle`: Toggle modal state

### useAsync

Manages async operation state.

```typescript
import { useAsync } from '@/lib/hooks'

const { data, loading, error, execute } = useAsync(
  async () => {
    const response = await fetch('/api/data')
    return response.json()
  },
  true // immediate
)

return (
  <div>
    {loading && <p>Loading...</p>}
    {error && <p>Error: {error.message}</p>}
    {data && <p>Data: {JSON.stringify(data)}</p>}
    <button onClick={execute}>Retry</button>
  </div>
)
```

**Parameters:**
- `asyncFunction`: Async function to execute
- `immediate`: Execute immediately on mount

**Returns:**
- `data`: Result data or null
- `loading`: Loading state
- `error`: Error object or null
- `execute`: Function to execute async operation

## Storage Hooks

### useLocalStorage

Manages localStorage with React state synchronization.

```typescript
import { useLocalStorage } from '@/lib/hooks'

const { value, setValue, removeValue, isLoaded } = useLocalStorage('theme', 'light')

return (
  <div>
    <p>Theme: {value}</p>
    <button onClick={() => setValue('dark')}>Dark Mode</button>
    <button onClick={() => removeValue()}>Reset</button>
  </div>
)
```

**Parameters:**
- `key`: localStorage key
- `initialValue`: Default value if not in storage

**Returns:**
- `value`: Current value
- `setValue`: Update value (and localStorage)
- `removeValue`: Remove from localStorage
- `isLoaded`: Whether localStorage has been read

## Pagination Hooks

### usePagination

Manages pagination state.

```typescript
import { usePagination } from '@/lib/hooks'

const {
  page,
  pageSize,
  total,
  totalPages,
  setTotal,
  goToPage,
  nextPage,
  prevPage,
  changePageSize,
  hasNextPage,
  hasPrevPage,
} = usePagination(10)

return (
  <div>
    <p>Page {page} of {totalPages}</p>
    <button onClick={prevPage} disabled={!hasPrevPage}>Previous</button>
    <button onClick={nextPage} disabled={!hasNextPage}>Next</button>
    <select value={pageSize} onChange={(e) => changePageSize(Number(e.target.value))}>
      <option value={10}>10</option>
      <option value={20}>20</option>
      <option value={50}>50</option>
    </select>
  </div>
)
```

**Parameters:**
- `initialPageSize`: Initial page size (default: 10)

**Returns:**
- `page`: Current page number
- `pageSize`: Items per page
- `total`: Total items
- `totalPages`: Total number of pages
- `setTotal`: Set total items
- `goToPage`: Go to specific page
- `nextPage`: Go to next page
- `prevPage`: Go to previous page
- `changePageSize`: Change page size
- `hasNextPage`: Whether next page exists
- `hasPrevPage`: Whether previous page exists

## Error Handling Hooks

### useApiErrorHandler

Handles API errors with notifications and logging.

```typescript
import { useApiErrorHandler } from '@/lib/hooks'

const { handleError, handleApiError } = useApiErrorHandler()

try {
  const response = await fetch('/api/users')
  if (!response.ok) {
    handleApiError(response.status, response.statusText)
  }
} catch (error) {
  handleError(error, 'Failed to fetch users')
}
```

**Returns:**
- `handleError`: Handle generic errors
- `handleApiError`: Handle HTTP errors by status code

## Best Practices

1. **Use useCache for frequently accessed data** to reduce API calls
2. **Use useForm for all form handling** to ensure consistent validation and error handling
3. **Use useLocalStorage for user preferences** (theme, language, etc.)
4. **Use usePagination for list views** to manage pagination state
5. **Use useApiErrorHandler for all API calls** to ensure consistent error handling
6. **Use useAsync for complex async operations** to manage loading and error states
7. **Combine hooks** to build complex features (e.g., useForm + useApiErrorHandler)

## Examples

### Complete User List with Pagination

```typescript
'use client'

import { useFetch, usePagination } from '@/lib/hooks'

export function UserList() {
  const { page, pageSize, total, setTotal, nextPage, prevPage, hasNextPage, hasPrevPage } = usePagination(10)
  const { data, loading, error, refetch } = useFetch(
    `/api/users?page=${page}&pageSize=${pageSize}`,
    { immediate: true }
  )

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <table>
        <tbody>
          {data?.items.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button onClick={prevPage} disabled={!hasPrevPage}>Previous</button>
        <span>Page {page}</span>
        <button onClick={nextPage} disabled={!hasNextPage}>Next</button>
      </div>
    </div>
  )
}
```

### Form with Validation

```typescript
'use client'

import { useForm } from '@/lib/hooks'

export function UserForm() {
  const { values, errors, loading, handleChange, handleSubmit } = useForm(
    { name: '', email: '' },
    async (values) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('Failed to create user')
    },
    (values) => {
      const errors = {}
      if (!values.name) errors.name = 'Name is required'
      if (!values.email) errors.email = 'Email is required'
      return errors
    }
  )

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" value={values.name} onChange={handleChange} />
      {errors.name && <span>{errors.name}</span>}
      <input name="email" value={values.email} onChange={handleChange} />
      {errors.email && <span>{errors.email}</span>}
      <button type="submit" disabled={loading}>Submit</button>
    </form>
  )
}
```
