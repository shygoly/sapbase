# UI Consistency Specification

## MODIFIED Requirements

### Requirement: AI-Generated Module UI Consistency
All AI-generated modules SHALL use the same UI components, styling, and patterns as standard system modules.

#### Scenario: Table List Display
- **WHEN** an AI-generated module displays a list of entities (e.g., Customers, Orders)
- **THEN** the table container SHALL use `rounded-lg border border-gray-200 bg-white` styling
- **AND** SHALL use the same table structure as standard modules (UsersList, DepartmentsList, RolesList)
- **AND** SHALL have consistent spacing with `space-y-4` wrapper
- **AND** SHALL use `overflow-x-auto` for horizontal scrolling

#### Scenario: Pagination Display
- **WHEN** an AI-generated module displays paginated data
- **THEN** the pagination SHALL use the standard pagination pattern
- **AND** SHALL display "Showing X to Y of Z" text on the left
- **AND** SHALL use Previous/Next buttons with page numbers in the center
- **AND** SHALL use `border-t border-gray-200 px-6 py-4` styling
- **AND** SHALL NOT use the `Pagination` component from `@/components/ui/pagination`

#### Scenario: Action Buttons
- **WHEN** an AI-generated module displays action buttons (Edit, Delete)
- **THEN** the buttons SHALL use icon buttons (`Edit2`, `Trash2` from lucide-react)
- **AND** SHALL use `variant="ghost" size="sm"` styling
- **AND** delete button SHALL use `text-red-600 hover:text-red-700` for destructive action
- **AND** SHALL NOT use text-based buttons ("Edit", "Delete")

#### Scenario: Empty State Display
- **WHEN** an AI-generated module has no data to display
- **THEN** the empty state SHALL display centered text
- **AND** SHALL use `text-center py-8 text-gray-500` styling
- **AND** SHALL match the empty state pattern of standard modules

#### Scenario: Badge and Status Display
- **WHEN** an AI-generated module displays status badges
- **THEN** the badges SHALL use consistent color mapping
- **AND** SHALL use the same Badge component styling as standard modules
- **AND** SHALL follow the same status color conventions (active=green, inactive=gray, etc.)

### Requirement: SchemaList Component Consistency
The `SchemaList` component SHALL match the styling and patterns of standard list components.

#### Scenario: SchemaList Table Container
- **WHEN** `SchemaList` component renders a table
- **THEN** the table container SHALL use `rounded-lg border border-gray-200 bg-white` styling
- **AND** SHALL wrap the table in `overflow-x-auto` div
- **AND** SHALL match the visual appearance of UsersList, DepartmentsList, RolesList

#### Scenario: SchemaList Pagination
- **WHEN** `SchemaList` component displays pagination
- **THEN** it SHALL use the standard pagination pattern (not `Pagination` component)
- **AND** SHALL display page information in the same format
- **AND** SHALL use the same button styling and layout

#### Scenario: SchemaList Action Buttons
- **WHEN** `SchemaList` component displays action buttons
- **THEN** it SHALL use icon buttons instead of text buttons
- **AND** SHALL use the same styling as standard modules
- **AND** SHALL support Edit and Delete actions with consistent icons

## ADDED Requirements

### Requirement: UI Style Guidelines for AI Module Generation
The system SHALL provide UI style guidelines for AI module generation.

#### Scenario: AI Module UI Generation
- **WHEN** an AI generates a new module using Patch DSL
- **THEN** the generated UI components SHALL follow the documented UI style guidelines
- **AND** SHALL use the same components as standard modules
- **AND** SHALL match the visual styling of existing modules
- **AND** SHALL be validated against UI consistency requirements

#### Scenario: UI Style Documentation
- **WHEN** a developer or AI needs to create a new module
- **THEN** the system SHALL provide clear documentation on:
  - Table component usage patterns
  - Pagination patterns
  - Action button patterns
  - Badge and status color patterns
  - Empty state patterns
- **AND** SHALL include code examples
- **AND** SHALL reference standard module implementations
