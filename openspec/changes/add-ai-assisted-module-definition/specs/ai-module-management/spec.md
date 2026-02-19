## ADDED Requirements

### Requirement: Step-Specific System Prompts for Module Definition
The system SHALL provide a dedicated system prompt for each of the six new module definition steps. When the AI is invoked for a given step, that step’s system prompt SHALL be sent as the system message so the AI returns output in the correct format for that step.

#### Scenario: Step 1 object model conversion
- **WHEN** the user submits natural language describing entities and fields (e.g. a CRM narrative listing Lead, Account, Contact, and their key fields)
- **AND** the system invokes the AI for the "object model" step
- **THEN** the system SHALL send the Step 1 system prompt (instructing conversion to a standard entity/field JSON) as the system message and the user’s text as the user message
- **AND** the AI response SHALL be parsed as the canonical object model structure (e.g. entities with identifier and fields with name, type, optional label/required)
- **AND** the result SHALL be returned to the client for that step only

#### Scenario: Each step has its own system prompt
- **WHEN** the AI is called for step N (N from 1 to 6: object model, relationships, state flow, pages, permissions, reports)
- **THEN** the system SHALL use the system prompt associated with step N
- **AND** the system prompt for step N SHALL describe the expected output format and domain rules for that step (e.g. relationships as source/target/type; state flow as states and transitions; permission rules as role and scope)
- **AND** the same configured AI model (e.g. default Kimi) SHALL be used for all steps

#### Scenario: System prompt instructs standard JSON output
- **WHEN** a step’s system prompt is sent to the AI
- **THEN** the prompt SHALL require the AI to respond with valid JSON only (or a single JSON block) matching the step’s output schema
- **AND** the backend SHALL extract that JSON and validate or parse it against the step’s expected shape before returning it to the client

### Requirement: API for Definition-Step AI Invocation
The system SHALL expose an API for invoking the AI on a single definition step with user-provided input and returning the structured output for that step.

#### Scenario: Client requests AI assistance for a step
- **WHEN** the client sends a request with a step identifier and the user’s natural language input for that step
- **THEN** the backend SHALL resolve the system prompt for that step, call the configured AI with that system prompt and the user input, and return the parsed structured output (or a clear error if parsing or AI call fails)
- **AND** the response SHALL NOT modify any persisted module; it SHALL be stateless and only return the generated artifact for the given step

#### Scenario: Unsupported or missing step identifier
- **WHEN** the client sends an unknown or missing step identifier
- **THEN** the backend SHALL respond with an error (e.g. 400) and SHALL NOT call the AI

### Requirement: Wizard UI Triggers AI Per Step
The new module definition wizard SHALL allow the user to request AI assistance for the current step using that step’s user input and SHALL display or merge the returned structure into the step’s state.

#### Scenario: User triggers "Generate from description" on a step
- **WHEN** the user has entered text in the current step and activates the AI assist action (e.g. "Generate from description")
- **THEN** the client SHALL send the step identifier and that text to the definition-step API
- **AND** on success, the wizard SHALL update the current step’s state with the returned structure (or append/preview as specified by product)
- **AND** on failure, the wizard SHALL show an error and leave the step content editable so the user can correct input or retry
