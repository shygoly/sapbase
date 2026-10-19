## ADDED Requirements

### Requirement: Provider-Neutral Model Gateway

AI design and runtime features SHALL call models through one provider-neutral gateway and SHALL store
credentials as secret references.

#### Scenario: Route a model request

- **WHEN** a task requests a model profile
- **THEN** the gateway SHALL resolve an approved provider, base URL, credential reference, model alias,
  reasoning policy, and output schema
- **AND** the trace SHALL record the requested alias and provider-reported resolved snapshot when
  available

#### Scenario: Reject arbitrary provider injection

- **WHEN** a tenant or Agent supplies an unapproved endpoint or plaintext credential
- **THEN** the request SHALL be rejected

### Requirement: Context Compiler

The system SHALL compile a minimal, permission-filtered Context Envelope before every design-time
model call.

#### Scenario: Build design context

- **WHEN** a user asks to modify an application model
- **THEN** the Context Compiler SHALL include only the relevant semantic graph, policies, conventions,
  and selected examples
- **AND** it SHALL exclude unauthorized or unrelated tenant content

#### Scenario: Context budget exceeded

- **WHEN** the candidate context exceeds the configured budget
- **THEN** the compiler SHALL apply deterministic dependency-aware pruning
- **AND** it SHALL report what categories were omitted

### Requirement: Delta-Only AI Authoring

LLM output for authoring SHALL be expressed as validated space-delta operations and MUST NOT become
the final Blueprint structure without passing validation and compilation.

#### Scenario: Propose a model change

- **WHEN** the user requests a new entity or rule
- **THEN** the model SHALL return Delta operations against a declared base revision
- **AND** the platform SHALL validate schema, references, permissions, and conflicts before applying

#### Scenario: Invalid Delta

- **WHEN** a Delta is malformed or refers to missing objects
- **THEN** the platform SHALL return structured diagnostics
- **AND** bounded repair MAY occur without bypassing final validation

### Requirement: Evaluation Gate Before Release

An AI-generated Blueprint revision SHALL pass deterministic simulation and the release's evaluation
suite before it can be published.

#### Scenario: Pass evaluation

- **WHEN** a candidate revision passes schema, compile, simulation, authorization, and evaluation gates
- **THEN** it MAY be packaged and signed as a new release

#### Scenario: Evaluation failure

- **WHEN** any gate fails
- **THEN** the release SHALL NOT be published or installed
- **AND** the system SHALL retain the evidence needed to reproduce the failure
