# CRM Module Specification

## ADDED Requirements

### Requirement: Customer Management
The system SHALL provide Customer management schema.

#### Scenario:
- **WHEN** a user accesses the CRM module
- **THEN** the system SHALL provide Customer object schema with fields: name, email, phone, company, industry, address, status, notes
- **AND** SHALL provide Customer list view at /crm/customers
- **AND** SHALL provide Customer form view for create/edit
- **AND** SHALL enforce permissions (view: admin/sales/manager, create/edit: admin/sales, delete: admin)

### Requirement: Order Management
The system SHALL provide Order management schema.

#### Scenario:
- **WHEN** a user accesses the CRM module
- **THEN** the system SHALL provide Order object schema with fields: orderNumber, customer (relation), orderDate, items, subtotal, tax, total, status, notes
- **AND** SHALL provide Order list view at /crm/orders
- **AND** SHALL provide Order form view for create/edit
- **AND** SHALL support order status state machine (pending → confirmed → processing → shipped → completed)
- **AND** SHALL enforce permissions (view: admin/sales/manager, create/edit: admin/sales, delete: admin)

### Requirement: Order Tracking
The system SHALL provide Order Tracking schema.

#### Scenario:
- **WHEN** a user views an order
- **THEN** the system SHALL provide OrderTracking object schema for tracking status changes
- **AND** SHALL provide tracking timeline view at /crm/orders/:id/tracking
- **AND** SHALL record status changes with timestamp and updatedBy
- **AND** SHALL enforce permissions (view: admin/sales/manager, create: admin/sales, edit/delete: admin)

### Requirement: Financial Transaction Management
The system SHALL provide Financial Transaction schema.

#### Scenario:
- **WHEN** a user accesses the CRM module
- **THEN** the system SHALL provide FinancialTransaction object schema with fields: transactionNumber, customer (relation), order (relation), type, amount, paymentMethod, date, status, notes
- **AND** SHALL provide Transaction list view at /crm/transactions
- **AND** SHALL provide Transaction form view for create/edit
- **AND** SHALL support transaction types: receipt, payment, refund, other
- **AND** SHALL enforce permissions (view: admin/sales/manager/accountant, create/edit: admin/accountant, delete: admin)

### Requirement: Patch DSL Demonstration
The CRM module SHALL demonstrate Patch DSL architecture.

#### Scenario:
- **WHEN** a developer wants to extend the CRM module
- **THEN** they SHALL be able to use Patch DSL to add fields without code changes
- **AND** example patches SHALL be provided for common extensions
- **AND** patches SHALL be validated, versioned, and hot-reloadable
- **AND** all changes SHALL be audited

### Requirement: Entity Relations
The CRM module SHALL support relations between entities.

#### Scenario:
- **WHEN** an Order is created
- **THEN** it SHALL reference a Customer via relation field
- **AND** when displaying the Order, the Customer name SHALL be shown instead of ID
- **AND** OrderTracking SHALL reference Order via relation
- **AND** FinancialTransaction SHALL reference both Customer and Order via relations
