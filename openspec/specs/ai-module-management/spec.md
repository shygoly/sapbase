# ai-module-management Specification

## Purpose
TBD - created by archiving change add-ai-assisted-module-definition. Update Purpose after archive.
## Requirements
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

### Requirement: New Module Definition Flow (6 Steps)
The system SHALL support creating a new module through a fixed 6-step definition order, distinct from applying incremental patches, and SHALL persist the resulting structured definition artifacts.

#### Scenario: Step order for new module
- **WHEN** a user creates a new module (not modifying an existing one)
- **THEN** the system SHALL present steps in order: 1 Object model, 2 Relationships, 3 State flow, 4 Pages, 5 Permissions, 6 Reports
- **AND** each step SHALL collect or generate the corresponding artifact (unified object model, relationships, state machine DSL, page schema, permission DSL, report config)
- **AND** the result SHALL NOT be a single prompt-to-patch; it SHALL be structured definitions that can later be modified by patches

#### Scenario: Completion persists definition artifacts
- **WHEN** the user completes the 6-step definition flow
- **THEN** the system SHALL persist a structured artifact bundle containing outputs from all completed steps
- **AND** persisted artifacts SHALL be retrievable for review and subsequent patch generation or module evolution
- **AND** completion SHALL fail with a clear error if artifact persistence fails

#### Scenario: CRM example complexity
- **WHEN** the module is CRM-style
- **THEN** relationships SHALL support chains such as Lead -> Account -> Opportunity -> Contract
- **AND** state flow SHALL support transitions such as draft -> qualified -> proposal -> won -> lost
- **AND** permission rules SHALL support sales (own only), manager (all), finance (e.g. contracts only)

### Requirement: New Module Definition Step Component
The system SHALL provide a step component (wizard) for the 6-step new module definition with deterministic save behavior.

#### Scenario: Wizard renders all six steps
- **WHEN** the user chooses to create a new module via the definition flow
- **THEN** the UI SHALL show a stepper with steps: Object model, Relationships, State flow, Pages, Permissions, Reports
- **AND** the user SHALL be able to move next/back and complete or skip steps within the flow
- **AND** state SHALL be retained across steps until submission

#### Scenario: Finish action enforces save contract
- **WHEN** the user selects the finish action in the wizard
- **THEN** the system SHALL persist step artifacts before marking the definition flow complete
- **AND** the UI SHALL communicate success only after persistence is confirmed
- **AND** the UI SHALL show a failure state and keep editable data if persistence is not confirmed

### Requirement: AI Module Lifecycle Documentation
The system SHALL define the AI module lifecycle states and the transitions between them.

#### Scenario: Create module
- **WHEN** a module is created
- **THEN** the system SHALL set its status to `draft`

#### Scenario: Submit for review
- **WHEN** a tested module is submitted for review
- **THEN** the system SHALL transition the status to `pending_review`

#### Scenario: Review decision
- **WHEN** a reviewer approves or rejects a module
- **THEN** the system SHALL update status to `approved` or `rejected` and store review comments

#### Scenario: Publish and unpublish
- **WHEN** an approved module is published
- **THEN** the system SHALL set status to `published`
- **AND** SHALL set `publishedAt`
- **WHEN** a published module is unpublished
- **THEN** the system SHALL set status to `unpublished`
- **AND** SHALL set `unpublishedAt`

### Requirement: Patch Generation and Storage
The system SHALL persist patch generation inputs and outputs for AI modules.

#### Scenario: Persist prompt and patch
- **WHEN** a natural language prompt is submitted for a module
- **THEN** the system SHALL store the prompt and the generated Patch DSL JSON in `patchContent`

#### Scenario: Persist test results
- **WHEN** tests are executed for a module
- **THEN** the system SHALL store `testResults` including pass/fail summary

### Requirement: AI Module Lifecycle Data Recording
The system SHALL persist patch content, test results, and review artifacts during the AI module lifecycle.

#### Scenario: Patch generation persists module data
- **WHEN** a patch is generated from a natural language prompt
- **THEN** the system SHALL store `patchContent`, `naturalLanguagePrompt`, and `aiModelId` on the module

#### Scenario: Test execution persists results
- **WHEN** module tests are executed
- **THEN** the system SHALL store `testResults` with pass/fail summary on the module

#### Scenario: Review decision persists status
- **WHEN** a reviewer approves or rejects a module
- **THEN** the system SHALL update the module status and store review comments

### Requirement: AI Definition Converts to Blueprint Layers

AI 生成的模块定义（`mergedDefinition`）MUST 能通过一个**纯函数**转换成蓝图分层
（`semantic` / `flows`，以及源中确实存在的 `rules` / `experience`），
且转换结果 MUST 通过既有蓝图协议（实体与字段命名、状态机完整性、流程为 DAG、动作齐全）；
不满足时 MUST 显式报错，MUST NOT 产出一个连编译都过不了的包。

#### Scenario: 完整定义可转换

**Given** 一份含对象模型与状态流的 `mergedDefinition`
**When** 执行转换
**Then** SHALL 产出可被既有编译器接受的 `semantic` 与 `flows` 层
**And** 转换 MUST 是纯函数（同样的输入必得同样的输出）

#### Scenario: 不合法的定义显式报错

**Given** 一份含非法实体名（不符合协议命名）的 `mergedDefinition`
**When** 执行转换
**Then** 转换 SHALL 失败并指明不合法的位置
**And** MUST NOT 通过改名或填充的方式把非法输入"修正"成合法

### Requirement: Missing Layers Stay Missing

转换器 MUST NOT 为 AI 未产出的部分编造层内容。
源中没有规则或经验策略时，产物 MUST NOT 包含 `rules.json` / `experience.json`，
MUST NOT 生成占位规则或占位策略。
（编造出来的规则会被下游当作真的执行，比缺层更危险。）

#### Scenario: 源里没有规则

**Given** 一份不含规则层的 `mergedDefinition`
**When** 转换并打包
**Then** 包内文件清单 SHALL NOT 含 `rules.json`
**And** MUST NOT 出现任何占位规则

#### Scenario: 源里确实有规则

**Given** 一份显式含蓝图规则层声明的 `mergedDefinition`
**When** 转换并打包
**Then** 产物 SHALL 含 `rules.json`
**And** 该层 SHALL 通过既有规则协议校验

### Requirement: AI Artifacts Use the Existing Delivery Chain

AI 产物落成蓝图包时 MUST 复用既有的打包与交付实现
（打包 → 编译出 IR → 写入编译记录 → 签名），MUST NOT 为 AI 另建一条打包或交付路径；
交付出的包 MUST 能被既有装载链装载（授权与验签通过）。

#### Scenario: AI 产物进既有链

**Given** 一份可转换的 `mergedDefinition`
**When** 执行交付
**Then** 清单 SHALL 记录 `compiled.irDigest` 与 `signature`
**And** 该包 SHALL 能通过既有装载链被装载

#### Scenario: 不为 AI 另建交付路径

**Given** AI 产物的交付过程
**When** 检查实现
**Then** 打包、编译、盖章、签名 SHALL 全部调用既有函数
**And** MUST NOT 存在第二条交付入口

### Requirement: AI Model Configuration
The system SHALL provide AI model configuration management.

#### Scenario: Configure Kimi API Model
- **WHEN** an administrator accesses AI Model Configuration
- **THEN** the system SHALL display a form for configuring AI models
- **AND** SHALL allow setting API key (KIMI_API_KEY)
- **AND** SHALL allow setting base URL (ANTHROPIC_BASE_URL)
- **AND** SHALL allow testing the API connection
- **AND** SHALL validate API credentials before saving
- **AND** SHALL store configuration securely
- **AND** SHALL enforce permissions (admin only)

#### Scenario: Test Model Connection
- **WHEN** an administrator tests an AI model configuration
- **THEN** the system SHALL send a test request to the API
- **AND** SHALL display connection status (success/failure)
- **AND** SHALL show error details if connection fails
- **AND** SHALL allow retry on failure

### Requirement: AI Module Development
The system SHALL provide an AI module development workspace.

#### Scenario: Generate Module from Natural Language
- **WHEN** a developer enters a natural language description in the development workspace
- **THEN** the system SHALL send the description to the configured AI model
- **AND** SHALL receive a Patch DSL JSON response
- **AND** SHALL display the generated patch in a preview editor
- **AND** SHALL allow editing the generated patch
- **AND** SHALL validate the patch against Patch DSL schema
- **AND** SHALL save the module as a draft

#### Scenario: Edit Generated Module
- **WHEN** a developer edits a generated module
- **THEN** the system SHALL provide a JSON editor with syntax highlighting
- **AND** SHALL validate changes in real-time
- **AND** SHALL show validation errors
- **AND** SHALL allow saving draft changes
- **AND** SHALL maintain version history

### Requirement: AI Module Testing
The system SHALL provide testing framework for AI-generated modules.

#### Scenario: Run CRM Test Suite
- **WHEN** a developer tests an AI-generated module
- **THEN** the system SHALL execute CRM module test suite
- **AND** SHALL test Customer entity operations (create, read, update, delete)
- **AND** SHALL test Order entity operations
- **AND** SHALL test OrderTracking entity operations
- **AND** SHALL test FinancialTransaction entity operations
- **AND** SHALL validate patch application against CRM schemas
- **AND** SHALL generate test report with pass/fail status

#### Scenario: View Test Results
- **WHEN** a test execution completes
- **THEN** the system SHALL display test results in a report
- **AND** SHALL show passed tests in green
- **AND** SHALL show failed tests in red with error details
- **AND** SHALL show test coverage metrics
- **AND** SHALL allow exporting test report

### Requirement: AI Module Review and Approval
The system SHALL provide review workflow for AI modules.

#### Scenario: Submit Module for Review
- **WHEN** a developer submits a tested module for review
- **THEN** the system SHALL change module status to "pending review"
- **AND** SHALL notify assigned reviewers
- **AND** SHALL require all tests to pass before submission
- **AND** SHALL attach test report to review request

#### Scenario: Review Module
- **WHEN** a reviewer accesses a pending module
- **THEN** the system SHALL display module details, patch content, and test results
- **AND** SHALL allow reviewer to add comments
- **AND** SHALL allow reviewer to approve or reject
- **AND** SHALL require rejection reason if rejected
- **AND** SHALL notify developer of review decision

#### Scenario: Approve Module
- **WHEN** a reviewer approves a module
- **THEN** the system SHALL change module status to "approved"
- **AND** SHALL make module available for publishing
- **AND** SHALL notify developer of approval
- **AND** SHALL record approval timestamp and reviewer

#### Scenario: Reject Module
- **WHEN** a reviewer rejects a module
- **THEN** the system SHALL change module status to "rejected"
- **AND** SHALL require rejection reason
- **AND** SHALL notify developer with rejection reason
- **AND** SHALL allow developer to revise and resubmit

### Requirement: AI Module Publishing
The system SHALL provide publishing functionality for approved modules.

#### Scenario: Publish Module (上架)
- **WHEN** an administrator publishes an approved module
- **THEN** the system SHALL change module status to "published"
- **AND** SHALL apply the patch to the system
- **AND** SHALL make the module available in production
- **AND** SHALL record publish timestamp
- **AND** SHALL create audit log entry
- **AND** SHALL enforce permissions (admin only)

#### Scenario: Unpublish Module (下架)
- **WHEN** an administrator unpublishes a module
- **THEN** the system SHALL change module status to "unpublished"
- **AND** SHALL rollback the patch if possible
- **AND** SHALL record unpublish timestamp
- **AND** SHALL create audit log entry
- **AND** SHALL enforce permissions (admin only)

#### Scenario: View Published Modules
- **WHEN** an administrator views published modules
- **THEN** the system SHALL display list of all published modules
- **AND** SHALL show publish date, version, and status
- **AND** SHALL allow filtering by status (published/unpublished)
- **AND** SHALL allow unpublishing modules

### Requirement: System Management Menu Integration
The system SHALL integrate AI module management into System Management menu.

#### Scenario: Access AI Module Management
- **WHEN** a user with appropriate permissions accesses System Management
- **THEN** the system SHALL display AI Module Management submenu
- **AND** SHALL include "Model Configuration" menu item
- **AND** SHALL include "AI Module Development" menu item
- **AND** SHALL include "AI Module Testing" menu item
- **AND** SHALL include "AI Module Review" menu item
- **AND** SHALL include "AI Module Publishing" menu item
- **AND** SHALL enforce permissions for each menu item

### Requirement: Audit and Versioning
The system SHALL track all AI module operations.

#### Scenario: Audit Logging
- **WHEN** any AI module operation occurs (create, test, review, publish, unpublish)
- **THEN** the system SHALL create an audit log entry
- **AND** SHALL record operation type, timestamp, user, and details
- **AND** SHALL allow viewing audit history
- **AND** SHALL allow filtering audit logs by operation type

#### Scenario: Version Control
- **WHEN** a module is modified
- **THEN** the system SHALL create a new version
- **AND** SHALL maintain version history
- **AND** SHALL allow viewing version differences
- **AND** SHALL allow rolling back to previous version

### Requirement: Role Mapping Declaration

`permissions.json` MAY declare `roleMappings` mapping an AI role to platform permission points; the runtime SHALL
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

### Requirement: Strict Definition JSON Validation

Every AI definition step output SHALL be validated against its step-specific JSON Schema
before it is returned to the client or persisted.

Validation failure SHALL return a clear error containing the step id and field path.
The backend MUST NOT persist an invalid step.

#### Scenario: Valid object model

- **WHEN** the AI returns `{ entities: [{ identifier, fields }] }` matching the object-model schema
- **THEN** the step SHALL be accepted and persisted

#### Scenario: Invalid field type

- **WHEN** a field declares an unsupported `type`
- **THEN** the request SHALL fail with the field path and allowed types
- **AND** no definition row SHALL be written

#### Scenario: Persisted definition is validated

- **WHEN** `saveDefinition` receives a definition with a non-empty invalid step
- **THEN** it SHALL reject the write
- **AND** existing persisted data SHALL remain unchanged

### Requirement: Deterministic Definition to Blueprint

`generateFromDefinition` SHALL convert the six-step definition to Blueprint layers
deterministically. It MUST NOT call an LLM for a second “Model DSL” translation.

The resulting `patchContent` SHALL contain `objects` and the Blueprint layers
(`semantic`, `flows`, and optional `rules` / `experience`) so existing publish metadata
extraction continues to work.

#### Scenario: Nested definition

- **WHEN** the definition uses `objectModel` / `stateFlow`
- **THEN** conversion SHALL produce semantic and flows layers

#### Scenario: Flat wizard payload

- **WHEN** the definition uses `entities` / `states` / `transitions`
- **THEN** it SHALL be normalized to the same internal shape before conversion

#### Scenario: Conversion failure

- **WHEN** an entity has no state machine or a field has an invalid name
- **THEN** the request SHALL fail with the conversion reason
- **AND** no module patch content SHALL be overwritten

### Requirement: No Silent Empty Patch

AI response extraction MUST fail explicitly when the response contains no JSON object or
invalid JSON. It MUST NOT substitute a default empty patch.

#### Scenario: Malformed response

- **WHEN** the model returns prose without a JSON object
- **THEN** the request SHALL fail with a parsing error
- **AND** no module record SHALL be updated

### Requirement: Full Lifecycle E2E Test
The system SHALL provide an executable end-to-end test that covers the full AI module lifecycle: create, approve, generate system, deploy, and uninstall (unpublish).

#### Scenario: Test sequence create through uninstall
- **WHEN** the full lifecycle E2E test runs
- **THEN** the test SHALL create an AI module (e.g. via POST create) and assert success and a valid module id
- **AND** SHALL submit the module for review and then approve it (submit-review, then review with decision approved) and assert status transition
- **AND** SHALL call the generate-system endpoint for the module and assert 200 and a non-empty jobId or status
- **AND** SHALL call the deploy endpoint (e.g. with moduleId or jobId) and assert 200 and a non-empty deployId or status
- **AND** SHALL unpublish the module and assert status is unpublished
- **AND** SHALL use an identity that has permission to perform all actions (e.g. admin or user with `system:generate` and review rights)

#### Scenario: Lifecycle test is runnable in test environment
- **WHEN** the test environment is set up (e.g. database seeded with admin and `system:generate` permission)
- **THEN** the full lifecycle test SHALL be runnable via a single command or script (e.g. npm script or test runner)
- **AND** SHALL not require real code generation or real deployment; it MAY use stub endpoints and assert on status/jobId responses
- **AND** SHALL be documented so that CI or a developer can run it after seed

#### Scenario: Uninstall step means at least unpublish
- **WHEN** the lifecycle test performs the "uninstall" (卸载) step
- **THEN** the test SHALL at least call unpublish on the module and assert the module status is unpublished
- **AND** MAY additionally trigger teardown of a deployed artifact when the system supports such an operation

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

