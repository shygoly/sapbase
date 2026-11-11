## ADDED Requirements

### Requirement: Server-Side Patch Application

The backend SHALL apply supported Patch DSL scopes (`object`, `state`) to the persisted
six-step definition and recompile a new Blueprint package.

Unsupported scopes (`page`, `permission`, `menu`) MUST fail with a clear error.
The backend MUST NOT silently ignore them.

#### Scenario: Add a field

- **GIVEN** an entity `Ticket` with field `title`
- **WHEN** an `object/add` patch adds `priority`
- **THEN** the persisted definition SHALL include `priority`
- **AND** a new package version SHALL be compiled

#### Scenario: Unsupported page patch

- **WHEN** a `page/update` patch is applied
- **THEN** the request SHALL fail with `unsupported-scope`
- **AND** the current definition/package SHALL remain unchanged

### Requirement: Patch Security Levels

The server SHALL reject `securityLevel: L3` patches and SHALL require explicit
`confirmed: true` for `securityLevel: L2` patches.

#### Scenario: L3 rejected

- **WHEN** a patch declares L3
- **THEN** the request SHALL fail
- **AND** no definition/package SHALL be written

#### Scenario: L2 requires confirmation

- **WHEN** a patch declares L2 without `confirmed: true`
- **THEN** the request SHALL fail with a confirmation error

### Requirement: Patch Produces a New Version

Applying a patch MUST bump the module patch version and MUST create a new package
whose id includes the new version. The previous package MUST NOT be overwritten.

#### Scenario: Version bump

- **GIVEN** module version `1.0.0`
- **WHEN** a valid patch is applied
- **THEN** the module version SHALL become `1.0.1`
- **AND** the package id SHALL be `<blueprint>-1.0.1`
