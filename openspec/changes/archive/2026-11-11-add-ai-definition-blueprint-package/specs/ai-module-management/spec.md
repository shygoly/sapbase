## ADDED Requirements

### Requirement: AI Definition Produces a Compiled Blueprint Package

`generateFromDefinition` MUST materialize the converted Blueprint layers into a `.erpkg`
and compile it with `stamp: true` before reporting success.

The module MUST record the resulting `packageId` and `irDigest`. A packaging or compilation
failure MUST fail the request and MUST NOT leave a half-written package in the packages
directory.

#### Scenario: Successful generation

- **WHEN** a valid six-step definition is converted
- **THEN** a `.erpkg` SHALL be written to the configured packages directory
- **AND** it SHALL be compiled and stamped with an IR digest
- **AND** `module.metadata.blueprint.packageId` SHALL reference it

#### Scenario: Compilation failure

- **WHEN** the generated package fails compilation (e.g. unresolved atomic dependency)
- **THEN** the request SHALL fail
- **AND** the partially written `.erpkg` SHALL be removed
- **AND** `module.metadata.blueprint` SHALL NOT be updated

### Requirement: Real Package Export

`module_registry.exportBlueprint` MUST return the AI-generated package when the module
records `metadata.blueprint.packageId`. It MUST only fall back to the minimal skeleton
when no real package exists.

#### Scenario: AI module export

- **GIVEN** a module with `metadata.blueprint.packageId` and an existing package
- **WHEN** the module is exported
- **THEN** the response SHALL point at the real package
- **AND** the package SHALL retain AI fields/states/rules

#### Scenario: Legacy module export

- **GIVEN** a module without a real package
- **WHEN** the module is exported
- **THEN** the existing minimal skeleton SHALL be produced
