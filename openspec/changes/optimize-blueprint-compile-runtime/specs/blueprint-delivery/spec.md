## ADDED Requirements

### Requirement: Compiled Runtime Artifact

`compileBlueprint` MUST be able to produce an immutable runtime artifact
(`CompiledBlueprint`) that contains the semantic entities, validation/approval/accounting
rules and the query index plan, in addition to the existing IR.

`loadBlueprint` MUST only return a loaded blueprint after the artifact is built successfully.
The runtime MUST read the compiled artifact instead of re-parsing `semantic.json` /
`rules.json` on every request.

#### Scenario: Load returns compiled template

- **WHEN** a valid `.erpkg` is loaded
- **THEN** `loaded.compiled.template.entities` SHALL contain the package entities
- **AND** `loaded.compiled.template.validation` SHALL contain the validation rules
- **AND** `loaded.compiled.indexPlan` SHALL list declared index candidates

#### Scenario: Invalid package does not produce an artifact

- **WHEN** compilation fails
- **THEN** no `CompiledBlueprint` SHALL be cached or returned

### Requirement: Bounded Runtime Cache

`BlueprintService` MUST cache loaded blueprints by `packageId + tenantId` and MUST invalidate
an entry when the package file fingerprint changes, the license expires, the TTL expires,
or `invalidate()` is called explicitly.

A cache hit MUST NOT unpack, compile or re-verify the package signature.

#### Scenario: Second load is a cache hit

- **GIVEN** a successfully loaded package
- **WHEN** the same package id and tenant is loaded again within TTL
- **THEN** the loader SHALL return the cached `LoadedBlueprint` instance
- **AND** MUST NOT invoke the compiler again

#### Scenario: Deliver invalidates the package cache

- **GIVEN** a cached package
- **WHEN** `deliver()` overwrites the same package id
- **THEN** the cache entry SHALL be removed
