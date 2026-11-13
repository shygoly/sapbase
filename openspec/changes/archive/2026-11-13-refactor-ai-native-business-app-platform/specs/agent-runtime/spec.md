## ADDED Requirements

### Requirement: Durable Agent Execution

The system SHALL persist Agent sessions, runs, steps, waits, and tool calls so a task can be replayed,
resumed, inspected, and cancelled.

#### Scenario: Resume after disconnect

- **WHEN** a client disconnects while a run is executing
- **THEN** the run SHALL continue according to its policy
- **AND** the client SHALL be able to reconnect and replay events after its last cursor

#### Scenario: Cancel a run

- **WHEN** an authorized user cancels a running run
- **THEN** no new tool call SHALL start
- **AND** in-flight work SHALL receive cancellation and the run SHALL end in `cancelled`

### Requirement: Agent Identity and Tool Scope

Every Agent invocation SHALL use a durable identity bound to an organization, app installation,
user or service principal, and Agent definition.

#### Scenario: Enforce allowed agents

- **WHEN** an Agent invokes a tool whose `allowedAgents` does not include its definition
- **THEN** the invocation SHALL be rejected and audited

#### Scenario: Ignore model identity claims

- **WHEN** model-supplied arguments claim another user, organization, app, or Agent identity
- **THEN** those claims SHALL have no effect on authorization

### Requirement: Deterministic Tool Execution Boundary

Agent runs SHALL act only through tools in the composed app catalog; they MUST NOT access databases,
filesystems, networks, or business services directly.

#### Scenario: Unknown tool

- **WHEN** an Agent requests a tool not present in its composed catalog
- **THEN** the platform SHALL report that the capability does not exist
- **AND** it SHALL NOT substitute an alternative tool

#### Scenario: Untrusted result

- **WHEN** a tool returns external document, web, email, or user-supplied text
- **THEN** the result SHALL be wrapped with a nonce-bound untrusted-data boundary
- **AND** instructions inside that text SHALL NOT be executed as platform instructions

### Requirement: Human Confirmation for Writes

Agent-initiated writes SHALL require a platform-issued confirmation token bound to the tool,
arguments, organization, app installation, run, and expiry.

#### Scenario: Missing confirmation

- **WHEN** an Agent invokes a write tool without a valid confirmation token
- **THEN** the write SHALL be rejected

#### Scenario: Reuse confirmation

- **WHEN** a confirmation token has already been consumed or its arguments differ
- **THEN** the invocation SHALL be rejected and audited

### Requirement: Run Budgets and Waits

Every run SHALL have enforceable limits for steps, wall time, model tokens or cost, child Agents,
and write actions.

#### Scenario: Budget exceeded

- **WHEN** a run reaches a configured limit
- **THEN** no further model or tool step SHALL start
- **AND** the run SHALL end in a resumable or failed state according to policy

#### Scenario: Wait for user

- **WHEN** an Agent requires missing information or a decision
- **THEN** the run SHALL enter `waiting_user`
- **AND** it SHALL resume only after an authorized user reply is persisted

### Requirement: Agent Audit and Replay

The system SHALL persist every model step, tool invocation, permission decision, confirmation,
cancellation, and result summary in an append-only trace associated with the run.

#### Scenario: Explain a result

- **WHEN** a completed result is opened
- **THEN** the platform SHALL show which tools supplied its facts, which policy decisions occurred,
  and which Agent definition and model profile were used
