## ADDED Requirements

### Requirement: Generic Blueprint UI Consumer

The system SHALL provide a runtime consumer that loads a published package's `ui.json`,
compiled entities and `permissions.json` and renders pages without generating static routes.

The consumer SHALL support `list`, `form`, and `detail` page types using the existing
`ui-runtime` components, and SHALL filter pages by the permission layer.

#### Scenario: Open a published app

- **WHEN** an authorized user opens `/dashboard/apps/<packageId>`
- **THEN** the first accessible page SHALL render
- **AND** list pages SHALL load records through the existing blueprint records API

#### Scenario: No accessible page

- **WHEN** the actor matches no page resource in `permissions.json`
- **THEN** the consumer SHALL show an explicit empty state
- **AND** MUST NOT render an unauthorized page

#### Scenario: Package without UI layer

- **WHEN** the package has no `ui.json`
- **THEN** the consumer SHALL show an explicit missing-layer message
