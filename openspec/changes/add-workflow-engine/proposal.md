# Change: Add Workflow Engine

## Why

The system currently has state machine definitions stored in AI module definitions (`step3_stateFlow`), but lacks an execution engine to actually run these workflows. Users can define state machines (e.g., Lead: 新建→已联系→合格|不合格; Opportunity: 初步接触→需求分析→方案报价→谈判中→赢单|输单), but there's no runtime system to:

- Execute state transitions based on business rules
- Track workflow instances and their current states
- Enforce transition rules and guard conditions
- Record workflow execution history
- Support conditional branching and parallel execution
- Integrate with entity lifecycle management

This change introduces a workflow engine that can execute state machines defined in module definitions, enabling dynamic business process automation.

## What Changes

- **ADDED**: Workflow definition storage and management (based on existing state machine definitions)
- **ADDED**: Workflow instance management (create, track, update instances)
- **ADDED**: State transition execution engine with validation
- **ADDED**: Guard conditions and conditional branching support
- **ADDED**: Workflow execution history and audit trail
- **ADDED**: API endpoints for workflow operations (start, transition, query status)
- **ADDED**: Integration with entity lifecycle (e.g., Opportunity state changes trigger workflow transitions)
- **ADDED**: Frontend UI for workflow visualization and management
- **MODIFIED**: Module registry to support workflow execution metadata

## Impact

- **NEW CAPABILITY**: Workflow execution becomes a first-class feature
- Affected specs: `workflow-engine` (new), `ai-module-management` (integration)
- Affected code:
  - Backend: New `workflows/` module with entities, services, controllers
  - Frontend: Workflow management UI, state visualization
  - Database: New tables for workflow definitions, instances, history
- Integration points: AI modules, module registry, entity services

## Out of Scope (this change)

- Complex workflow patterns (sub-workflows, compensation, long-running transactions)
- Workflow versioning and migration
- External workflow orchestration (BPMN, Camunda integration)
- Workflow templates marketplace
- Advanced scheduling and cron-based triggers
- Workflow analytics and reporting (basic history included)

## Clarifications Needed

Before implementation, confirm:

1. **Workflow Definition Source**: Should workflows be automatically created from `step3_stateFlow` definitions, or manually defined separately?
2. **Execution Model**: Synchronous (immediate) vs asynchronous (background jobs) execution?
3. **Integration Scope**: Which entities should support workflow execution initially? (e.g., all entities with state machines, or specific module types)
4. **User Permissions**: Who can execute workflow transitions? (e.g., entity owners, specific roles, automated triggers)
