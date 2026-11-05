## ADDED Requirements

### Requirement: Sign and Load Existing AI Packages

The backend SHALL be able to add a license to an existing `.erpkg`, repack it, compile/stamp
it, and sign it with Ed25519.

After signing, the package MUST be loadable for the licensed tenant. If load fails, the
module MUST NOT record `loadedAt`.

#### Scenario: Sign an AI package

- **GIVEN** an unsigned AI `.erpkg` with a compiled IR digest
- **WHEN** `deliverPackage` is called with `grantedTo` containing the tenant
- **THEN** the package SHALL contain `license.json`
- **AND** `manifest.signature` SHALL be present
- **AND** loading it with that tenant SHALL succeed

#### Scenario: Tenant not licensed

- **GIVEN** a signed package granted to `org-a`
- **WHEN** it is loaded with `org-b`
- **THEN** loading SHALL fail as unauthorized
- **AND** `metadata.blueprint.loadedAt` SHALL NOT be written

### Requirement: AI Blueprint Delivery Endpoint

`POST /ai-modules/:id/blueprint/deliver` SHALL accept `grantedTo`, optional `expiresAt`,
`issuer`, `resell`, and perform sign + load verification.

#### Scenario: Successful delivery

- **WHEN** a module has `metadata.blueprint.packageId` and the request is valid
- **THEN** the response SHALL include the package id and IR digest
- **AND** `metadata.blueprint` SHALL record signed/loaded timestamps and grant

#### Scenario: Missing private key

- **WHEN** `BLUEPRINT_LICENSE_PRIVATE_KEY` is not configured
- **THEN** the request SHALL fail
- **AND** the package SHALL remain unchanged
