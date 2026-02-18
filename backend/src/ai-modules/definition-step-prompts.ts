/**
 * Step identifiers for the 6-step new module definition flow.
 * Used by POST /api/ai-modules/definition-step.
 */
export const DEFINITION_STEP_IDS = [
  'object-model',
  'relationships',
  'state-flow',
  'pages',
  'permissions',
  'reports',
] as const

export type DefinitionStepId = (typeof DEFINITION_STEP_IDS)[number]

const OBJECT_MODEL_PROMPT = `You are a module definition assistant. Convert the user's natural language description of entities and their fields into a single JSON object. Respond with valid JSON only, no markdown or explanation.

CRITICAL: You MUST use the user's complete input. Extract every entity and every field they describe. Do not return a simplified example or a minimal subset. If the user lists many entities (e.g. Lead, Contact, Account, Opportunity, Contract, Product, Task, etc.), include every one with all the fields they specify. Do not substitute or summarize.

Required output shape:
{
  "entities": [
    {
      "identifier": "EntityName",
      "label": "Optional display name",
      "fields": [
        { "name": "fieldName", "label": "Optional label", "type": "string" | "number" | "boolean" | "date", "required": false }
      ]
    }
  ]
}

Extract all entities and all fields mentioned in the user message. Use identifier as PascalCase, name as camelCase. Preserve the user's intended field names and types.`

const RELATIONSHIPS_PROMPT = `You are a module definition assistant. You will receive "Context from previous steps" (e.g. Step 1 object model with entities and fields). If the user also provides "Current step input", use it to refine; if there is NO or minimal current step input, generate a complete relationships definition from the context alone. Infer all sensible entity relationships from the entities (e.g. Lead→Account, Account→Contact, Account→Opportunity, Opportunity→Contract, Campaign→Lead, Order→Account/Contact, Invoice→Order, Task/Interaction→Opportunity/Contact). Respond with valid JSON only.

Required output shape:
{
  "relationships": [
    { "source": "SourceEntity", "target": "TargetEntity", "type": "one-to-one" | "one-to-many" | "many-to-many", "description": "optional" }
  ]
}`

const STATE_FLOW_PROMPT = `You are a module definition assistant. You will receive "Context from previous steps" (object model, relationships). If the user also provides current step input, use it; otherwise generate state flows from context alone. For each entity that has a lifecycle (Lead, Opportunity, SupportTicket, Contract, Task, Order, etc.), define states and transitions (e.g. Lead: 新建→已联系→合格|不合格; Opportunity: 初步接触→需求分析→方案报价→谈判中→赢单|输单; Contract: 草稿→已签署→执行中→已过期; Task: 未开始→进行中→已完成). Respond with valid JSON only.

Required output shape:
{
  "states": [ { "name": "stateName", "initial": false, "transitions": ["targetState"] } ]
}`

const PAGES_PROMPT = `You are a module definition assistant. You will receive "Context from previous steps" (object model, relationships, state flows). If the user also provides current step input, use it; otherwise generate a complete page set from context alone. For each entity in the object model, add list + form + detail pages (e.g. LeadList, LeadForm, LeadDetail; AccountList, AccountForm, AccountDetail). Detail pages should reflect key relationships (e.g. AccountDetail shows related Contact, Opportunity, Contract). Include pages for all entities. Respond with valid JSON only.

Required output shape:
{
  "pages": [ { "identifier": "PageId", "label": "Page title", "type": "list" | "form" | "detail", "entity": "EntityName" } ]
}`

const PERMISSIONS_PROMPT = `You are a module definition assistant. You will receive "Context from previous steps" (object model, relationships, pages). If the user also provides current step input, use it; otherwise infer permission rules from context. Define roles such as sales (own leads/opportunities), manager (team or all), admin (all), support (own tickets), and assign scope (own | team | all) and resources (entity names from the object model). Respond with valid JSON only.

Required output shape:
{
  "rules": [ { "role": "roleName", "scope": "own" | "team" | "all", "resources": ["EntityName"] } ]
}`

const REPORTS_PROMPT = `You are a module definition assistant. You will receive "Context from previous steps" (object model, relationships, pages, permissions). If the user also provides current step input, use it; otherwise generate a sensible report set from context. Include reports such as: pipeline by stage (Opportunity), lead source summary, sales by account/period, quota attainment, ticket volume, contract renewal. Use entity names from the object model. Respond with valid JSON only.

Required output shape:
{
  "reports": [ { "identifier": "ReportId", "label": "Report title", "entities": ["EntityName"], "description": "optional" } ]
}`

const PROMPTS: Record<DefinitionStepId, string> = {
  'object-model': OBJECT_MODEL_PROMPT,
  'relationships': RELATIONSHIPS_PROMPT,
  'state-flow': STATE_FLOW_PROMPT,
  'pages': PAGES_PROMPT,
  'permissions': PERMISSIONS_PROMPT,
  'reports': REPORTS_PROMPT,
}

export function getDefinitionStepPrompt(stepId: string): string {
  if (DEFINITION_STEP_IDS.includes(stepId as DefinitionStepId)) {
    return PROMPTS[stepId as DefinitionStepId]
  }
  throw new Error(`Unknown definition step id: ${stepId}. Valid: ${DEFINITION_STEP_IDS.join(', ')}`)
}
