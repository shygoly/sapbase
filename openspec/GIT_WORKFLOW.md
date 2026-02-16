# OpenSpec Git Workflow Guide

## Current Status

You are currently on the `main` branch with uncommitted changes from OpenSpec implementations.

## Recommended Git Workflow for OpenSpec Changes

### Best Practice: Feature Branch per Change

For each OpenSpec change, create a feature branch:

```bash
# 1. Create branch for the change
git checkout -b feature/migrate-schema-system-from-legacy

# 2. Implement the change (using /openspec-apply)
# ... work on implementation ...

# 3. Commit changes
git add openspec/changes/migrate-schema-system-from-legacy/
git add speckit/src/core/schema/
git add speckit/src/components/schema-form.tsx
git add speckit/src/components/schema-list.tsx
git commit -m "feat: migrate schema system from legacy (OpenSpec: migrate-schema-system-from-legacy)"

# 4. Push and create PR
git push origin feature/migrate-schema-system-from-legacy
# Create PR on GitHub/GitLab

# 5. After PR merge and deployment, archive the change
openspec archive migrate-schema-system-from-legacy --yes
```

### Alternative: Work Directly on Main (Not Recommended)

If working directly on `main`:
- ✅ Simpler for solo development
- ❌ Risk of breaking main branch
- ❌ Harder to review changes
- ❌ No easy rollback

## OpenSpec Workflow vs Git Workflow

### OpenSpec Stages

1. **Stage 1: Creating Changes** (Proposal)
   - Create proposal in `openspec/changes/<id>/`
   - Can be on any branch or main
   - No code changes yet

2. **Stage 2: Implementing Changes** (Apply)
   - **Recommended**: Create feature branch
   - Implement code changes
   - Commit OpenSpec change + implementation together

3. **Stage 3: Archiving Changes** (Archive)
   - After PR merge and deployment
   - Move change to `archive/` directory
   - Update specs if needed

## Current Situation

You have:
- ✅ OpenSpec proposals created (in `openspec/changes/`)
- ✅ Schema system implementation (partially complete)
- ⚠️ All changes on `main` branch (uncommitted)

## Recommended Next Steps

### Option 1: Create Feature Branches (Recommended)

```bash
# For Schema migration
git checkout -b feature/migrate-schema-system-from-legacy
git add openspec/changes/migrate-schema-system-from-legacy/
git add speckit/src/core/schema/
git add speckit/src/components/schema-form.tsx
git add speckit/src/components/schema-list.tsx
git add speckit/public/specs/
git add speckit/docs/schema-system.md
git commit -m "feat: migrate schema system from legacy"

# For Patch DSL system (when ready)
git checkout -b feature/add-patch-dsl-system
# ... implement ...
```

### Option 2: Commit to Main (Quick but Risky)

```bash
# Commit everything to main
git add .
git commit -m "feat: add schema system and patch DSL proposals"
git push origin main
```

## Branch Naming Convention

Use descriptive branch names:
- `feature/<openspec-change-id>` - For feature implementations
- `fix/<issue>` - For bug fixes
- `docs/<topic>` - For documentation

Examples:
- `feature/migrate-schema-system-from-legacy`
- `feature/add-patch-dsl-system`
- `fix/schema-validation-bug`

## PR Workflow

1. Create feature branch
2. Implement change
3. Commit with descriptive message including OpenSpec change ID
4. Push branch
5. Create PR with:
   - Description referencing OpenSpec change
   - Link to `openspec/changes/<id>/proposal.md`
6. Review and merge
7. After deployment: Archive OpenSpec change

## Commit Message Format

```
<type>: <description> (OpenSpec: <change-id>)

- Reference OpenSpec change ID
- Include relevant details
- Link to proposal if helpful
```

Examples:
```
feat: migrate schema system from legacy (OpenSpec: migrate-schema-system-from-legacy)

Implements Phase 2 schema system migration:
- Core schema types, resolver, validator, registry
- SchemaForm and SchemaList components
- Integration with Runtime components
- Documentation and examples

See: openspec/changes/migrate-schema-system-from-legacy/
```

## Summary

**Current State**: Working on `main` branch
**Recommended**: Create feature branches for each OpenSpec change
**After PR Merge**: Archive the OpenSpec change

OpenSpec changes can be developed on any branch, but feature branches provide better isolation and review process.
