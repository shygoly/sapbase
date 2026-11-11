## ADDED Requirements

### Requirement: Page and Permission Declarations

The semantic authoring layer MAY declare pages and permissions; `definitionToBlueprint` SHALL
MUST map non-empty pages to `ui.json` and non-empty permission rules to
`permissions.json`.

Empty or absent declarations MUST NOT create empty layers.

#### Scenario: Pages map to UI layer

- **WHEN** the definition contains pages for `Ticket`
- **THEN** `ui.json` SHALL contain those pages
- **AND** `irDigest` SHALL change when a page changes

#### Scenario: Empty pages

- **WHEN** the definition contains `pages: []`
- **THEN** no `ui.json` SHALL be written

### Requirement: Patch Support for UI and Permissions

Server-side patches SHALL support `page`, `permission`, and `menu` scopes with
add/update/remove operations. Unsupported payloads MUST fail explicitly.

#### Scenario: Add page

- **WHEN** a `page/add` patch provides `payload.page`
- **THEN** the definition SHALL contain the page
- **AND** the next compile SHALL include it in `ui.json`

#### Scenario: Add permission rule

- **WHEN** a `permission/add` patch provides `payload.permission`
- **THEN** the rule SHALL be persisted and published

#### Scenario: Add menu without pages

- **WHEN** a `menu/add` patch is applied to a definition with no pages
- **THEN** it SHALL fail because `ui.json` requires a non-empty page list
