# Change: AI-Assisted Module Definition with Step-Specific System Prompts

## Why
When creating a new module via the 6-step definition flow, users need to supply structured artifacts (object model, relationships, state flow, pages, permissions, reports). Manually authoring these from scratch is heavy. Users can instead describe intent in natural language (e.g. a CRM narrative describing entities, fields, and architecture). The system SHALL use the configured AI to convert that input into the standard JSON or structured definition for each step. Each step requires a **system prompt** that instructs the AI on the expected output format and domain rules so that (1) Step 1 turns entity/field descriptions into a unified object-model JSON, (2) Step 2 turns relationship descriptions into a relationship schema, and so on for all six steps.

## What Changes
- **ADDED**: Per-step system prompts for the 6-step new module definition flow (Step 1: entity/field → object model JSON; Step 2: relationship narrative → relationship schema; Step 3: state narrative → state machine DSL; Step 4: page description → page schema; Step 5: permission narrative → permission DSL; Step 6: report description → report config).
- **ADDED**: Backend API (or extension of existing AI module API) to invoke the configured AI with a step identifier and user input, sending the step’s system prompt plus user content, and returning the structured output for that step.
- **ADDED**: Storage or configuration of the six system prompts (e.g. backend config, database, or bundled defaults) so that every AI call for a definition step uses the correct prompt.
- **ADDED**: Wizard UI affordance per step (e.g. “Generate from description”) that sends the step’s user input to the backend and fills the step’s state with the AI-generated structured result.
- **DOCUMENTED**: Expected output schema or shape for each step so that system prompts and parsers can be aligned (e.g. Step 1: list of entities, each with name and list of fields with name, type, optional attributes).

## Impact
- Affected specs: `ai-module-management`
- Affected code: `backend/src/ai-modules/` (new or extended endpoint, prompt resolution), `speckit/src/app/admin/ai-modules/develop/new-module-wizard.tsx` (per-step AI trigger and result handling), and optionally a prompt store or config module.

## Example (Step 1)
- **User input**: Long CRM narrative (e.g. “对于200人销售队伍… Lead (线索): 姓名、公司、联系方式… Account: 公司名称、行业、规模…”) as in the user story.
- **System prompt**: Instructs the AI to act as a module definition assistant, to extract entities and their fields from the narrative, and to return a standard JSON structure (e.g. `{ "entities": [ { "identifier": "Lead", "label": "线索", "fields": [ { "name": "name", "label": "姓名", "type": "string" }, ... ] }, ... ] }` or equivalent).
- **Result**: The wizard Step 1 state is populated with this JSON so the user can edit or proceed; the same pattern applies to Steps 2–6 with their own prompts and output shapes.
