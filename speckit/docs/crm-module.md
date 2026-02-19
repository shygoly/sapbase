# CRM Module Documentation

## Overview

The CRM (Customer Relationship Management) module demonstrates the Patch DSL architecture in action. It includes four core entities:

1. **Customer (客户)** - Customer management
2. **Order (订单)** - Order management
3. **Order Tracking (订单跟踪)** - Order status tracking
4. **Financial Transaction (资金往来)** - Payment and transaction records

## Module Structure

### Objects

#### Customer (`/specs/objects/customer.json`)
- **Fields**: name, email, phone, company, industry, address, status, notes
- **Relations**: None
- **Permissions**: View (admin, sales, manager), Create/Edit (admin, sales), Delete (admin)

#### Order (`/specs/objects/order.json`)
- **Fields**: orderNumber, customer (relation), orderDate, items, subtotal, tax, total, status, notes
- **Relations**: customer (many-to-one)
- **State Machine**: pending → confirmed → processing → shipped → completed
- **Permissions**: View (admin, sales, manager), Create/Edit (admin, sales), Delete (admin)

#### OrderTracking (`/specs/objects/order-tracking.json`)
- **Fields**: order (relation), status, timestamp, notes, updatedBy
- **Relations**: order (many-to-one)
- **Permissions**: View (admin, sales, manager), Create (admin, sales), Edit/Delete (admin)

#### FinancialTransaction (`/specs/objects/financial-transaction.json`)
- **Fields**: transactionNumber, customer (relation), order (relation), type, amount, paymentMethod, date, status, notes
- **Relations**: customer (many-to-one), order (many-to-one)
- **Permissions**: View (admin, sales, manager, accountant), Create/Edit (admin, accountant), Delete (admin)

### Views

- **customer-list** - Customer list view with grid layout
- **customer-form** - Customer form for create/edit
- **order-list** - Order list view
- **order-form** - Order form for create/edit
- **order-tracking-list** - Order tracking timeline view
- **transaction-list** - Financial transaction list view
- **transaction-form** - Financial transaction form

### Pages

- `/crm/customers` - Customer list page
- `/crm/customers/new` - Create customer
- `/crm/customers/:id/edit` - Edit customer
- `/crm/orders` - Order list page
- `/crm/orders/new` - Create order
- `/crm/orders/:id/edit` - Edit order
- `/crm/orders/:id/tracking` - Order tracking page
- `/crm/transactions` - Transaction list page
- `/crm/transactions/new` - Create transaction

## Testing the Module

### 1. Load Schemas

```typescript
import { SchemaResolver } from '@/core/schema/resolver'
import { SchemaRegistry } from '@/core/schema/registry'

const resolver = new SchemaResolver()
const registry = new SchemaRegistry()

// Load Customer schema
const customerSchema = await resolver.loadObjectSchema('Customer')
registry.registerObject('Customer', customerSchema!)

// Load Order schema
const orderSchema = await resolver.loadObjectSchema('Order')
registry.registerObject('Order', orderSchema!)

// Load page schema
const customersPage = await resolver.loadPageSchema('/crm/customers')
const resolvedPage = await resolver.resolvePage('/crm/customers')
```

### 2. Test Patch DSL Extensions

```typescript
import { PatchManager } from '@/core/patch/patch-manager'
import { PatchGateway } from '@/core/patch/gateway'
import { KimiClient } from '@/lib/ai/kimi-client'

// Initialize
const patchManager = new PatchManager(resolver, registry)
const kimiClient = new KimiClient()
const gateway = new PatchGateway(patchManager, kimiClient)

// Generate patch using AI
const response = await gateway.generatePatch({
  intent: "为 Customer 对象添加 website 网站字段",
  context: {
    targetSchema: "Customer",
    constraints: ["字段类型为 text", "非必填"]
  }
})

// Apply patch
if (response.patch) {
  const result = await patchManager.applyPatch(response.patch)
  console.log('Patch applied:', result.success)
}
```

### 3. Apply Example Patches

```typescript
// Load example patch
import customerWebsitePatch from '@/public/patches/examples/crm-add-customer-website.json'

const result = await patchManager.applyPatch(customerWebsitePatch)
if (result.success) {
  console.log('Customer website field added!')
  // Schema is now updated, UI will hot-reload
}
```

### 4. Test Relations

```typescript
// Create an order with customer relation
const order = {
  orderNumber: 'ORD-001',
  customer: 'Customer-123', // Reference to customer
  orderDate: '2026-02-16',
  items: JSON.stringify([{ name: 'Product A', quantity: 10, price: 100 }]),
  subtotal: 1000,
  tax: 100,
  total: 1100,
  status: 'pending'
}

// The relation will be resolved when loading the order
const resolvedOrder = await resolver.resolvePage('/crm/orders')
// Customer name will be displayed instead of ID
```

## Example Patches

### Add Website Field to Customer
```json
{
  "version": "1.0",
  "patchId": "crm-001-add-website-field",
  "scope": "object",
  "operation": "add",
  "target": { "type": "field", "identifier": "Customer" },
  "payload": {
    "field": {
      "name": "website",
      "label": "网站",
      "type": "text",
      "required": false
    }
  }
}
```

### Add Priority Field to Order
```json
{
  "version": "1.0",
  "patchId": "crm-002-add-priority-field",
  "scope": "object",
  "operation": "add",
  "target": { "type": "field", "identifier": "Order" },
  "payload": {
    "field": {
      "name": "priority",
      "label": "优先级",
      "type": "select",
      "options": [
        { "label": "低", "value": "low" },
        { "label": "普通", "value": "normal" },
        { "label": "高", "value": "high" }
      ]
    }
  }
}
```

## Extending the Module

Using Patch DSL, you can extend the CRM module without code changes:

1. **Add new fields** - Use object scope patches
2. **Add new columns** - Use page scope patches
3. **Modify permissions** - Use permission scope patches
4. **Add states** - Use state scope patches
5. **Add menu items** - Use menu scope patches

All changes are:
- ✅ Validated before application
- ✅ Versioned for rollback
- ✅ Hot-reloaded without rebuild
- ✅ Fully audited

## Integration with Kimi AI

The module can be extended using natural language with Kimi AI:

```typescript
// Ask AI to add a field
const patch = await gateway.generatePatch({
  intent: "为订单添加预计交付日期字段",
  context: {
    targetSchema: "Order",
    constraints: ["日期类型", "非必填"]
  }
})

// AI generates the patch JSON
// Apply it automatically (L1) or with confirmation (L2)
await patchManager.applyPatch(patch.patch)
```

## Next Steps

1. Implement API routes for CRUD operations
2. Connect to database (PostgreSQL, MongoDB, etc.)
3. Add authentication and authorization
4. Implement form validation
5. Add data visualization (charts, reports)
6. Create mobile-responsive views
