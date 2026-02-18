# Change: Create CRM Module Using Patch DSL Architecture

## Why

To demonstrate and test the Patch DSL system, we'll create a complete CRM (Customer Relationship Management) module with four core entities:
1. Customer Management (客户维护)
2. Order Management (订单维护)
3. Order Tracking (订单跟踪)
4. Financial Transactions (资金往来)

This will showcase how Patch DSL enables declarative schema-driven development without code changes.

## What Changes

- **ADDED**: Customer object schema with fields (name, email, phone, address, company, etc.)
- **ADDED**: Order object schema with fields (orderNumber, customer, items, total, status, etc.)
- **ADDED**: OrderTracking object schema for tracking order status changes
- **ADDED**: FinancialTransaction object schema for recording payments and transactions
- **ADDED**: View schemas for list and form views of each entity
- **ADDED**: Page schemas for routing and navigation
- **ADDED**: Example patches demonstrating Patch DSL usage

## Impact

- **Affected specs**: New schemas in `patch-dsl-system` capability
- **Affected code**:
  - `speckit/public/specs/objects/` - New object schemas
  - `speckit/public/specs/views/` - New view schemas
  - `speckit/public/specs/pages/` - New page schemas
  - `speckit/public/patches/examples/` - CRM-related example patches
- **Breaking changes**: None (additive only)

## CRM Module Structure

### 1. Customer (客户)
- Fields: name, email, phone, address, company, industry, status, notes
- Views: Customer List, Customer Form, Customer Detail
- Pages: /customers, /customers/new, /customers/:id/edit

### 2. Order (订单)
- Fields: orderNumber, customer (relation), orderDate, items, subtotal, tax, total, status, notes
- Views: Order List, Order Form, Order Detail
- Pages: /orders, /orders/new, /orders/:id/edit

### 3. Order Tracking (订单跟踪)
- Fields: order (relation), status, timestamp, notes, updatedBy
- Views: Tracking List, Tracking Timeline
- Pages: /orders/:id/tracking

### 4. Financial Transaction (资金往来)
- Fields: transactionNumber, order (relation), customer (relation), type, amount, paymentMethod, date, status, notes
- Views: Transaction List, Transaction Form
- Pages: /transactions, /transactions/new

## Success Criteria

- ✅ All four CRM entities have complete schemas
- ✅ List and form views work correctly
- ✅ Relations between entities are properly defined
- ✅ Pages are accessible and functional
- ✅ Example patches demonstrate Patch DSL usage
- ✅ System can be extended using patches without code changes

## Implementation Status

- ✅ Created 4 object schemas (Customer, Order, OrderTracking, FinancialTransaction)
- ✅ Created 7 view schemas (lists and forms)
- ✅ Created 10 page schemas (routing)
- ✅ Created 4 example patches demonstrating Patch DSL usage
- ✅ Created CRM module documentation (`speckit/docs/crm-module.md`)
- ✅ All schemas follow Patch DSL architecture
- ✅ Relations properly defined between entities
- ✅ Permissions configured for each entity
