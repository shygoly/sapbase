## ADDED Requirements

### Requirement: Blueprint Permission Enforcement

Runtime write/list/read/transition/delete/import SHALL evaluate the package's
`permissions.json` rules.

If no layer or the rules array is empty, the existing behavior SHALL be preserved.
If a layer exists and no rule matches role/resource/action, the operation MUST fail with 403.

#### Scenario: Role matches

- **GIVEN** `sales → Ticket → own → read`
- **WHEN** a user with role `sales` reads `Ticket`
- **THEN** the operation SHALL be allowed

#### Scenario: Role mapping matches

- **GIVEN** `roleMappings.auditor = ['audit:read']`
- **WHEN** a user with `audit:read` but role `member` reads `Ticket`
- **THEN** the operation SHALL be allowed

#### Scenario: Unmatched role

- **WHEN** a user matches no rule for the resource
- **THEN** the operation SHALL fail with 403
- **AND** MUST NOT read/write the record
