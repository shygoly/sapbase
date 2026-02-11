# Utilities Reference

## Overview

This document provides a reference for all utility functions available in the Speckit ERP Frontend Runtime. These utilities simplify common operations and reduce boilerplate code.

## String Formatting

Located in `speckit/src/lib/format.ts`:

### formatDate

Formats a date object or string to a specified format.

```typescript
import { formatDate } from '@/lib'

formatDate(new Date(), 'YYYY-MM-DD') // "2026-02-07"
formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss') // "2026-02-07 14:30:45"
```

### formatCurrency

Formats a number as currency.

```typescript
import { formatCurrency } from '@/lib'

formatCurrency(1234.56) // "$1,234.56"
formatCurrency(1234.56, 'EUR') // "€1,234.56"
```

### formatNumber

Formats a number with specified decimal places.

```typescript
import { formatNumber } from '@/lib'

formatNumber(1234.5678, 2) // "1234.57"
```

### truncate

Truncates text to a maximum length.

```typescript
import { truncate } from '@/lib'

truncate('This is a long text', 10) // "This is a ..."
```

### capitalize

Capitalizes the first letter of a string.

```typescript
import { capitalize } from '@/lib'

capitalize('hello') // "Hello"
```

### camelToKebab / kebabToCamel

Converts between camelCase and kebab-case.

```typescript
import { camelToKebab, kebabToCamel } from '@/lib'

camelToKebab('myVariableName') // "my-variable-name"
kebabToCamel('my-variable-name') // "myVariableName"
```

## Validation

Located in `speckit/src/lib/validate.ts`:

### isEmail

Validates email format.

```typescript
import { isEmail } from '@/lib'

isEmail('user@example.com') // true
isEmail('invalid-email') // false
```

### isPhone

Validates phone number format.

```typescript
import { isPhone } from '@/lib'

isPhone('+1 (555) 123-4567') // true
isPhone('123') // false
```

### isUrl

Validates URL format.

```typescript
import { isUrl } from '@/lib'

isUrl('https://example.com') // true
isUrl('not a url') // false
```

### isStrongPassword

Validates password strength (8+ chars, uppercase, lowercase, number, special char).

```typescript
import { isStrongPassword } from '@/lib'

isStrongPassword('MyPass123!') // true
isStrongPassword('weak') // false
```

### isEmpty

Checks if a value is empty.

```typescript
import { isEmpty } from '@/lib'

isEmpty('') // true
isEmpty([]) // true
isEmpty({}) // true
isEmpty(null) // true
```

### isValidLength

Validates string length is within range.

```typescript
import { isValidLength } from '@/lib'

isValidLength('hello', 3, 10) // true
isValidLength('hi', 3, 10) // false
```

## Array Operations

Located in `speckit/src/lib/array.ts`:

### unique

Removes duplicate items from array.

```typescript
import { unique } from '@/lib'

unique([1, 2, 2, 3, 3, 3]) // [1, 2, 3]
unique(users, (u) => u.id) // Remove duplicates by id
```

### groupBy

Groups array items by a key function.

```typescript
import { groupBy } from '@/lib'

const grouped = groupBy(users, (u) => u.department)
// { engineering: [...], sales: [...] }
```

### sortBy

Sorts array by a key function.

```typescript
import { sortBy } from '@/lib'

sortBy(users, (u) => u.name) // Sort by name ascending
sortBy(users, (u) => u.age, 'desc') // Sort by age descending
```

### chunk

Splits array into chunks of specified size.

```typescript
import { chunk } from '@/lib'

chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
```

### flatten

Flattens nested arrays.

```typescript
import { flatten } from '@/lib'

flatten([[1, 2], [3, 4], 5]) // [1, 2, 3, 4, 5]
```

### findIndex

Finds index of first item matching predicate.

```typescript
import { findIndex } from '@/lib'

findIndex(users, (u) => u.id === 5) // Returns index or -1
```

## Object Operations

Located in `speckit/src/lib/object.ts`:

### pick

Selects specific properties from object.

```typescript
import { pick } from '@/lib'

const user = { id: 1, name: 'John', email: 'john@example.com' }
pick(user, ['id', 'name']) // { id: 1, name: 'John' }
```

### omit

Removes specific properties from object.

```typescript
import { omit } from '@/lib'

const user = { id: 1, name: 'John', password: 'secret' }
omit(user, ['password']) // { id: 1, name: 'John' }
```

### merge

Merges multiple objects (shallow).

```typescript
import { merge } from '@/lib'

merge({ a: 1 }, { b: 2 }, { c: 3 }) // { a: 1, b: 2, c: 3 }
```

### deepMerge

Merges objects recursively (deep).

```typescript
import { deepMerge } from '@/lib'

deepMerge(
  { user: { name: 'John' } },
  { user: { email: 'john@example.com' } }
) // { user: { name: 'John', email: 'john@example.com' } }
```

### isEmpty

Checks if object has no properties.

```typescript
import { isEmpty } from '@/lib'

isEmpty({}) // true
isEmpty({ a: 1 }) // false
```

### keys / values / entries

Gets object keys, values, or entries.

```typescript
import { keys, values, entries } from '@/lib'

const obj = { a: 1, b: 2 }
keys(obj) // ['a', 'b']
values(obj) // [1, 2]
entries(obj) // [['a', 1], ['b', 2]]
```

## Performance Utilities

Located in `speckit/src/lib/performance.ts`:

### debounce

Delays function execution until after specified wait time.

```typescript
import { debounce } from '@/lib'

const handleSearch = debounce((query) => {
  searchUsers(query)
}, 300)

// Call multiple times, but only executes once after 300ms of inactivity
```

### throttle

Limits function execution to once per specified interval.

```typescript
import { throttle } from '@/lib'

const handleScroll = throttle(() => {
  loadMoreData()
}, 1000)

// Called multiple times, but only executes once per 1000ms
```

## Caching

Located in `speckit/src/lib/cache.ts`:

### Cache Class

In-memory cache with TTL support.

```typescript
import { cache } from '@/lib'

// Set cache
cache.set('users', userData, 5 * 60 * 1000) // 5 minutes TTL

// Get cache
const data = cache.get('users')

// Check if exists
if (cache.has('users')) {
  // ...
}

// Delete
cache.delete('users')

// Clear all
cache.clear()

// Get size
console.log(cache.size())
```

## Usage Examples

### Complete User Management Example

```typescript
'use client'

import {
  useForm,
  usePagination,
  useFetch,
  useApiErrorHandler,
} from '@/lib/hooks'
import { isEmail, isEmpty, sortBy } from '@/lib'

export function UserManagement() {
  const { page, pageSize, total, setTotal, nextPage, prevPage } = usePagination(10)
  const { data: users, loading, refetch } = useFetch(
    `/api/users?page=${page}&pageSize=${pageSize}`
  )
  const { values, errors, handleChange, handleSubmit } = useForm(
    { name: '', email: '' },
    async (values) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('Failed to create user')
      refetch()
    },
    (values) => {
      const errors = {}
      if (isEmpty(values.name)) errors.name = 'Name is required'
      if (!isEmail(values.email)) errors.email = 'Invalid email'
      return errors
    }
  )

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input name="name" value={values.name} onChange={handleChange} />
        {errors.name && <span>{errors.name}</span>}
        <input name="email" value={values.email} onChange={handleChange} />
        {errors.email && <span>{errors.email}</span>}
        <button type="submit">Add User</button>
      </form>

      <table>
        <tbody>
          {users?.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <button onClick={prevPage}>Previous</button>
        <span>Page {page}</span>
        <button onClick={nextPage}>Next</button>
      </div>
    </div>
  )
}
```

## Best Practices

1. **Use format utilities for consistent formatting** across the app
2. **Use validation utilities for input validation** before submission
3. **Use array utilities for data transformation** instead of manual loops
4. **Use object utilities for safe property access** and merging
5. **Use debounce for search/filter inputs** to reduce API calls
6. **Use throttle for scroll/resize events** to improve performance
7. **Combine utilities** to build complex features
8. **Import from @/lib** for convenient access to all utilities
