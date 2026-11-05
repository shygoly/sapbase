## ADDED Requirements

### Requirement: Declarative Permission Rules

`permissions.json` SHALL be treated as declarative role/resource/scope rules. It MUST NOT
silently replace platform RBAC permission points.

The runtime MAY expose the rules to clients; server-side enforcement by role mapping is a
separate concern and MUST NOT be implied by the presence of the layer.

#### Scenario: Permissions layer is read-only declaration

- **WHEN** a package declares `sales → Ticket → own`
- **THEN** the layer SHALL be readable by authorized clients
- **AND** the platform RBAC checks SHALL remain in force
