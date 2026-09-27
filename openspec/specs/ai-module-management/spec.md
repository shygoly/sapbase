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

