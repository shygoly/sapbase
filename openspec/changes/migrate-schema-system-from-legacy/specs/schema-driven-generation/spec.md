# Schema-Driven Generation Capability

## ADDED Requirements

### Requirement: Schema System Core
The system SHALL provide a three-layer Schema architecture for defining data structures, UI layouts, and page routing:
- ObjectSchema: Defines data structure with fields, types, validation rules, and permissions
- ViewSchema: Defines UI layout (list, form, detail, dashboard) referencing an ObjectSchema
- PageSchema: Defines routing, metadata, and permissions referencing a ViewSchema

#### Scenario: Load ObjectSchema from JSON file
- **WHEN** the system loads an ObjectSchema from `public/specs/objects/user.json`
- **THEN** it SHALL parse the JSON and create an ObjectSchema instance with all fields, validation rules, and permissions
- **AND** the SchemaResolver SHALL cache the loaded schema for performance

#### Scenario: Resolve complete PageSchema
- **WHEN** the system resolves a PageSchema by path (e.g., "users")
- **THEN** it SHALL load the PageSchema, resolve the referenced ViewSchema, resolve the referenced ObjectSchema
- **AND** return a ResolvedPageSchema with all fields, permissions, and metadata merged
- **AND** cache all resolved schemas to avoid redundant file loading

### Requirement: Schema Form Generation
The system SHALL provide a SchemaForm component that dynamically generates forms from ObjectSchema definitions.

#### Scenario: Generate form from ObjectSchema
- **WHEN** a developer provides an ObjectSchema to SchemaForm component
- **THEN** the component SHALL render form fields for each field in the schema
- **AND** each field SHALL use the appropriate input type (text, email, select, date, etc.) based on field.type
- **AND** validation rules SHALL be applied based on field.validation array
- **AND** required fields SHALL be marked with visual indicators
- **AND** readonly fields SHALL be disabled

#### Scenario: Form submission with validation
- **WHEN** a user submits a SchemaForm
- **THEN** the system SHALL validate all fields against their validation rules
- **AND** if validation fails, SHALL display error messages for invalid fields
- **AND** if validation passes, SHALL call the onSubmit callback with form data

#### Scenario: Field type rendering
- **WHEN** SchemaForm renders a field with type "select"
- **THEN** it SHALL render a dropdown with options from field.options
- **WHEN** SchemaForm renders a field with type "date"
- **THEN** it SHALL render a date picker component
- **WHEN** SchemaForm renders a field with type "checkbox" and displayAs "switch"
- **THEN** it SHALL render a Switch component instead of checkbox

### Requirement: Schema List Generation
The system SHALL provide a SchemaList component that dynamically generates lists/tables from ObjectSchema definitions.

#### Scenario: Generate list from ObjectSchema
- **WHEN** a developer provides an ObjectSchema and data array to SchemaList component
- **THEN** the component SHALL render a table with columns for each non-hidden field
- **AND** column headers SHALL use field.label
- **AND** cells SHALL render values formatted according to field.type
- **AND** hidden fields SHALL not be displayed

#### Scenario: List sorting
- **WHEN** a user clicks on a column header in SchemaList
- **THEN** the list SHALL sort data by that field
- **AND** clicking again SHALL reverse sort order
- **AND** clicking a third time SHALL remove sorting

#### Scenario: List pagination
- **WHEN** SchemaList displays more than 10 items
- **THEN** it SHALL paginate results with 10 items per page
- **AND** SHALL display pagination controls
- **AND** users SHALL be able to navigate between pages

### Requirement: Schema Validation
The system SHALL validate Schema definitions and form data against schemas.

#### Scenario: Validate ObjectSchema structure
- **WHEN** the system loads an ObjectSchema from JSON
- **THEN** it SHALL validate that required fields (name, label, fields, version) are present
- **AND** validate that each field has required properties (name, label, type)
- **AND** if validation fails, SHALL throw an error with details

#### Scenario: Validate form data against ObjectSchema
- **WHEN** form data is validated against an ObjectSchema
- **THEN** it SHALL check required fields are present
- **AND** check field values match validation rules (min, max, pattern, etc.)
- **AND** return validation result with field-level error messages

### Requirement: Schema Registry
The system SHALL provide a SchemaRegistry for managing loaded schemas in memory.

#### Scenario: Register and retrieve ObjectSchema
- **WHEN** an ObjectSchema is registered with name "user"
- **THEN** the registry SHALL store it with key "object:user"
- **AND** getObject("user") SHALL return the registered schema
- **AND** has("object", "user") SHALL return true

#### Scenario: Register and retrieve ViewSchema
- **WHEN** a ViewSchema is registered with name "user-list"
- **THEN** the registry SHALL store it with key "view:user-list"
- **AND** getView("user-list") SHALL return the registered schema

#### Scenario: Register and retrieve PageSchema
- **WHEN** a PageSchema is registered with path "users"
- **THEN** the registry SHALL store it with key "page:users"
- **AND** getPage("users") SHALL return the registered schema

### Requirement: Integration with Runtime Components
The system SHALL integrate Schema system with existing Runtime components (PageRuntime, FormRuntime, CollectionRuntime).

#### Scenario: Use Schema with PageRuntime
- **WHEN** a developer resolves a PageSchema and converts it to PageModel
- **THEN** the PageModel SHALL include permissions from the schema
- **AND** PageRuntime SHALL enforce those permissions
- **AND** the page SHALL work with existing Runtime architecture

#### Scenario: Use SchemaForm with FormRuntime
- **WHEN** SchemaForm is used inside FormRuntime
- **THEN** FormRuntime SHALL enforce form-level permissions from schema
- **AND** SchemaForm SHALL enforce field-level permissions
- **AND** both permission systems SHALL work together

#### Scenario: Use SchemaList with CollectionRuntime
- **WHEN** SchemaList is used inside CollectionRuntime
- **THEN** CollectionRuntime SHALL enforce collection-level permissions
- **AND** SchemaList SHALL respect field-level visibility permissions
- **AND** both systems SHALL work together

### Requirement: Schema File Structure
The system SHALL support loading schemas from JSON files in a structured directory.

#### Scenario: Load ObjectSchema from file
- **WHEN** the system loads ObjectSchema from `public/specs/objects/user.json`
- **THEN** it SHALL read the JSON file
- **AND** parse it as ObjectSchema
- **AND** cache it in SchemaRegistry

#### Scenario: Load ViewSchema from file
- **WHEN** the system loads ViewSchema from `public/specs/views/user-list.json`
- **THEN** it SHALL read the JSON file
- **AND** parse it as ViewSchema
- **AND** validate that referenced ObjectSchema exists

#### Scenario: Load PageSchema from file
- **WHEN** the system loads PageSchema from `public/specs/pages/users.json`
- **THEN** it SHALL read the JSON file
- **AND** parse it as PageSchema
- **AND** validate that referenced ViewSchema exists
