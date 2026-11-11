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

