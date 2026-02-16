# Schema-Driven Generation System

The Schema system enables AI-driven page, form, and view generation from JSON schema definitions. This document explains how to use the Schema system.

## Overview

The Schema system uses a three-layer architecture:

1. **ObjectSchema** - Defines data structure with fields, types, validation rules, and permissions
2. **ViewSchema** - Defines UI layout (list, form, detail, dashboard) referencing an ObjectSchema
3. **PageSchema** - Defines routing, metadata, and permissions referencing a ViewSchema

## Quick Start

### 1. Define an ObjectSchema

Create a JSON file in `public/specs/objects/`:

```json
{
  "name": "product",
  "label": "Product",
  "version": "1.0.0",
  "fields": [
    {
      "name": "name",
      "label": "Product Name",
      "type": "text",
      "required": true,
      "validation": [
        {
          "type": "required",
          "message": "Product name is required"
        }
      ]
    },
    {
      "name": "price",
      "label": "Price",
      "type": "number",
      "required": true
    }
  ],
  "permissions": {
    "view": ["product.list"],
    "create": ["product.create"],
    "edit": ["product.edit"],
    "delete": ["product.delete"]
  }
}
```

### 2. Define a ViewSchema

Create a JSON file in `public/specs/views/`:

```json
{
  "name": "product-list",
  "type": "list",
  "object": "product",
  "version": "1.0.0",
  "layout": {
    "type": "grid",
    "fields": ["name", "price"]
  }
}
```

### 3. Define a PageSchema

Create a JSON file in `public/specs/pages/`:

```json
{
  "path": "products",
  "view": "product-list",
  "metadata": {
    "title": "Products",
    "description": "Manage products"
  },
  "permissions": ["product.list"],
  "version": "1.0.0"
}
```

### 4. Use in a Page Component

```tsx
'use client'

import { useEffect, useState } from 'react'
import { schemaResolver, buildPageModelFromSchema, buildCollectionModelFromSchema } from '@/core/schema'
import { PageRuntime } from '@/components/runtime/PageRuntime'
import { CollectionRuntime } from '@/components/runtime/CollectionRuntime'
import { SchemaList } from '@/components/schema-list'
import type { ResolvedPageSchema, ObjectSchema } from '@/core/schema/types'

export default function ProductsPage() {
  const [resolvedSchema, setResolvedSchema] = useState<ResolvedPageSchema | null>(null)
  const [objectSchema, setObjectSchema] = useState<ObjectSchema | null>(null)
  const [data, setData] = useState([])

  useEffect(() => {
    async function loadSchema() {
      const resolved = await schemaResolver.resolvePage('products')
      setResolvedSchema(resolved)
      
      const objSchema = await schemaResolver.loadObjectSchema('product')
      setObjectSchema(objSchema)
    }
    loadSchema()
  }, [])

  if (!resolvedSchema || !objectSchema) {
    return <div>Loading...</div>
  }

  const pageModel = buildPageModelFromSchema(resolvedSchema)
  const collectionModel = buildCollectionModelFromSchema(resolvedSchema)

  return (
    <PageRuntime model={pageModel}>
      <CollectionRuntime model={collectionModel}>
        <SchemaList
          schema={objectSchema}
          data={data}
          onEdit={(row) => console.log('Edit', row)}
          onDelete={(row) => console.log('Delete', row)}
        />
      </CollectionRuntime>
    </PageRuntime>
  )
}
```

## Field Types

The Schema system supports the following field types:

- `text` - Text input
- `number` - Number input
- `email` - Email input
- `password` - Password input
- `textarea` - Multi-line text
- `select` - Dropdown select
- `checkbox` - Checkbox (can use `displayAs: 'switch'` for Switch component)
- `date` - Date picker
- `datetime` - Date and time picker
- `relation` - Relation to another object
- `file` - File upload

## Validation Rules

Fields can have validation rules:

```json
{
  "name": "email",
  "label": "Email",
  "type": "email",
  "required": true,
  "validation": [
    {
      "type": "required",
      "message": "Email is required"
    },
    {
      "type": "pattern",
      "value": "^[^@]+@[^@]+\\.[^@]+$",
      "message": "Invalid email format"
    },
    {
      "type": "min",
      "value": 5,
      "message": "Email must be at least 5 characters"
    },
    {
      "type": "max",
      "value": 100,
      "message": "Email must be at most 100 characters"
    }
  ]
}
```

## Components

### SchemaForm

Dynamically generates forms from ObjectSchema:

```tsx
import { SchemaForm } from '@/components/schema-form'
import { schemaResolver } from '@/core/schema'

const schema = await schemaResolver.loadObjectSchema('product')

<SchemaForm
  schema={schema}
  initialData={productData}
  onSubmit={async (data) => {
    await api.post('/products', data)
  }}
/>
```

### SchemaList

Dynamically generates lists/tables from ObjectSchema:

```tsx
import { SchemaList } from '@/components/schema-list'
import { schemaResolver } from '@/core/schema'

const schema = await schemaResolver.loadObjectSchema('product')

<SchemaList
  schema={schema}
  data={products}
  onEdit={(product) => navigate(`/products/${product.id}/edit`)}
  onDelete={(product) => api.delete(`/products/${product.id}`)}
/>
```

## Integration with Runtime Components

The Schema system integrates seamlessly with Runtime components:

```tsx
import { PageRuntime } from '@/components/runtime/PageRuntime'
import { CollectionRuntime } from '@/components/runtime/CollectionRuntime'
import { FormRuntime } from '@/components/runtime/FormRuntime'
import {
  schemaResolver,
  buildPageModelFromSchema,
  buildCollectionModelFromSchema,
  buildFormModelFromSchema
} from '@/core/schema'

// For list pages
const resolved = await schemaResolver.resolvePage('products')
const pageModel = buildPageModelFromSchema(resolved)
const collectionModel = buildCollectionModelFromSchema(resolved)

<PageRuntime model={pageModel}>
  <CollectionRuntime model={collectionModel}>
    <SchemaList schema={objectSchema} data={data} />
  </CollectionRuntime>
</PageRuntime>

// For form pages
const resolved = await schemaResolver.resolvePage('products-create')
const pageModel = buildPageModelFromSchema(resolved)
const formModel = buildFormModelFromSchema(resolved)

<PageRuntime model={pageModel}>
  <FormRuntime model={formModel}>
    <SchemaForm schema={objectSchema} onSubmit={handleSubmit} />
  </FormRuntime>
</PageRuntime>
```

## Examples

See example schemas in:
- `public/specs/objects/user.json`
- `public/specs/views/user-list.json`
- `public/specs/pages/users.json`

## API Reference

### SchemaResolver

```typescript
// Resolve a complete page schema
const resolved = await schemaResolver.resolvePage('users')

// Load individual schemas
const objectSchema = await schemaResolver.loadObjectSchema('user')
const viewSchema = await schemaResolver.loadViewSchema('user-list')
const pageSchema = await schemaResolver.loadPageSchema('users')

// Clear cache
schemaResolver.clearCache()
schemaResolver.clearCacheFor('object', 'user')
```

### SchemaValidator

```typescript
import { schemaValidator } from '@/core/schema'

// Validate schema structure
const isValid = schemaValidator.validateObjectSchema(schema)

// Validate form data
const validation = schemaValidator.validateFormData(formData, objectSchema)
if (!validation.valid) {
  console.log(validation.errors)
}
```

### SchemaRegistry

```typescript
import { schemaRegistry } from '@/core/schema'

// Register schemas
schemaRegistry.registerObject('user', objectSchema)
schemaRegistry.registerView('user-list', viewSchema)
schemaRegistry.registerPage('users', pageSchema)

// Retrieve schemas
const userSchema = schemaRegistry.getObject('user')
const hasSchema = schemaRegistry.has('object', 'user')
```
