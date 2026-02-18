# Tasks: AI-Assisted Module Definition

## 1. Backend: System prompts and resolution
- [x] 1.1 Define the six step identifiers (e.g. object-model, relationships, state-flow, pages, permissions, reports) in code or config
- [x] 1.2 Add storage or bundle for the six system prompts (e.g. backend config file or constants) with content that instructs the AI to return standard JSON for that step
- [x] 1.3 Implement a resolver that, given a step id, returns the system prompt text for that step (fail clearly if step id is unknown)

## 2. Backend: Definition-step API
- [x] 2.1 Add endpoint POST /api/ai-modules/definition-step (or equivalent) accepting body { stepId: string, userInput: string }
- [x] 2.2 Implement handler that resolves the step’s system prompt, obtains the default AI model (reuse existing AIModelsService), and calls the AI with system message = prompt and user message = userInput
- [x] 2.3 Parse the AI response to extract JSON and, if needed, validate or coerce to the step’s output shape; return the structured result in the response (or return 4xx/5xx with a clear message on parse or AI failure)
- [x] 2.4 Ensure the endpoint is protected with the same auth as other AI module endpoints (e.g. system:manage or equivalent)

## 3. Output schema documentation
- [x] 3.1 Document the canonical output JSON shape for Step 1 (object model: entities and fields)
- [x] 3.2 Document the canonical output shape for Steps 2–6 (relationships, state flow, pages, permissions, reports) so that system prompts and parsers can align

## 4. Frontend: Wizard integration
- [x] 4.1 Add a “Generate from description” (or equivalent) control to each step of the new module definition wizard that is visible when the user has entered text
- [x] 4.2 On action, call the definition-step API with the current step id and the step’s text input; on success, update the wizard state for that step with the returned structure; on failure, show an error and keep the form editable
- [x] 4.3 Add loading and error states so the user knows when the AI is running and when a failure occurred

## 5. Validation and quality
- [x] 5.1 Add at least one integration or E2E test: send a known CRM-style narrative to Step 1 and assert the response is valid JSON with entities and fields (or equivalent smoke test)
- [x] 5.2 Run openspec validate add-ai-assisted-module-definition --strict and fix any validation issues
