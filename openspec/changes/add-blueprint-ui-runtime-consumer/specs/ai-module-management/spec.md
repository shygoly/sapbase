## ADDED Requirements

### Requirement: Role Mapping Declaration

`permissions.json` MAY declare `roleMappings` mapping an AI role to platform permission
points. A mapped role SHALL be considered present when any mapped permission point is held.

`roleMappings` MUST NOT bypass platform RBAC checks; it only maps AI roles for Blueprint
resource decisions.

#### Scenario: Mapped role

- **GIVEN** `roleMappings.sales = ['crm:sales']`
- **WHEN** a user has `crm:sales`
- **THEN** rules for `sales` SHALL apply

#### Scenario: No mapping

- **GIVEN** no `roleMappings` entry for `sales`
- **WHEN** a user has role `member`
- **THEN** the `sales` rules SHALL NOT apply
