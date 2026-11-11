# AI Module Management System

## Overview

This change introduces a comprehensive AI module management system that enables:
1. **AI Model Configuration**: Configure and manage AI models (Kimi API)
2. **AI Module Development**: Generate modules from natural language using AI
3. **AI Module Testing**: Test AI-generated modules using CRM module as test suite
4. **AI Module Review**: Review and approve modules before publishing
5. **AI Module Publishing**: Publish (上架) and unpublish (下架) approved modules

## Architecture

### Components

1. **AI Model Configuration** (`/admin/ai-models`)
   - Configure Kimi API credentials
   - Test API connections
   - Manage multiple AI models

2. **AI Module Development** (`/admin/ai-modules/develop`)
   - Natural language input interface
   - AI-powered patch generation
   - Patch preview and editing
   - Version control

3. **AI Module Testing** (`/admin/ai-modules/test`)
   - CRM module test suite integration
   - Automated test execution
   - Test result reporting

4. **AI Module Review** (`/admin/ai-modules/review`)
   - Review workflow (pending → reviewing → approved/rejected)
   - Reviewer assignment
   - Comments and feedback

5. **AI Module Publishing** (`/admin/ai-modules/publish`)
   - Publish approved modules (上架)
   - Unpublish modules (下架)
   - Version management
   - Rollback capability

### Database Schema

- `ai_models`: AI model configurations
- `ai_modules`: AI-generated modules (drafts, pending, approved, rejected, published)
- `ai_module_tests`: Test cases and results
- `ai_module_reviews`: Review records
- `published_modules`: Published module registry

### Integration Points

- **Patch DSL System**: Uses Patch DSL for module definition
- **CRM Module**: Serves as test suite for validation
- **Kimi API**: Primary AI model provider
- **Audit System**: Tracks all operations

## Workflow

1. **Configure AI Model**: Admin configures Kimi API credentials
2. **Develop Module**: Developer enters natural language description
3. **Generate Patch**: AI generates Patch DSL JSON
4. **Test Module**: System runs CRM test suite
5. **Submit for Review**: Developer submits tested module
6. **Review Module**: Reviewer approves or rejects
7. **Publish Module**: Admin publishes approved module (上架)
8. **Monitor**: System tracks usage and performance

## Configuration

### Environment Variables

```bash
KIMI_API_KEY=sk-kimi-NFr9OldbRTRzzyFCJbNTozG1LPP9yb90Uas7AomC4Lz57OomFPk7115ZhDSBHmlJ
ANTHROPIC_BASE_URL=https://api.kimi.com/coding/
```

### Permissions

- **Model Configuration**: Admin only
- **Module Development**: Developers
- **Module Testing**: Developers
- **Module Review**: Reviewers, Admin
- **Module Publishing**: Admin only

## Testing

The CRM module serves as the primary test suite:
- Customer entity tests
- Order entity tests
- OrderTracking entity tests
- FinancialTransaction entity tests
- Cross-entity relation tests

## Success Metrics

- AI modules can be generated from natural language
- Generated modules pass CRM test suite
- Review workflow functions correctly
- Modules can be published and unpublished
- All operations are audited
