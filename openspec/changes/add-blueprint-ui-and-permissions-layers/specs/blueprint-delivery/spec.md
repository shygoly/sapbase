## ADDED Requirements

### Requirement: UI and Permissions Layers

Blueprint packages MAY contain `ui.json` and `permissions.json`; the platform SHALL validate both files when present.

`ui.json` SHALL declare pages (identifier/type/entity and optional route/fields) and optional
menus. `permissions.json` SHALL declare role → resources → scope/actions.

Both layers MUST be covered by JSON Schema and included in the IR digest. Unknown or
malformed layers MUST fail compilation.

#### Scenario: Compile a package with UI

- **WHEN** a package contains `ui.json` with a page referencing an existing entity
- **THEN** compilation SHALL succeed
- **AND** the IR SHALL contain a `ui` layer digest

#### Scenario: Page references a missing entity

- **WHEN** `ui.json` references an entity not declared in `semantic.json`
- **THEN** compilation SHALL fail with a conflict
- **AND** the conflict SHALL name the page and entity

#### Scenario: Permissions reference a missing resource

- **WHEN** `permissions.json` grants access to an undeclared entity
- **THEN** compilation SHALL fail with a conflict

### Requirement: Runtime Reads Published UI and Permissions

The runtime SHALL expose the loaded package's UI and permissions layers after license and
tenant validation.

#### Scenario: Read UI

- **WHEN** an authorized tenant requests `GET /blueprints/:id/ui`
- **THEN** the response SHALL contain the published pages/menus
- **AND** an unauthorized tenant SHALL be rejected

#### Scenario: Layer absent

- **WHEN** a package has no `ui.json`
- **THEN** the endpoint SHALL return 404
