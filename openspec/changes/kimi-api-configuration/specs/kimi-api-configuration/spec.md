# Kimi API Configuration Specification

## ADDED Requirements

### Requirement: Configure Kimi API as Default AI Model
The system SHALL have Kimi API configured as the default AI model for patch generation.

#### Scenario: Kimi Model Configuration
- **WHEN** the system is seeded with mock data
- **THEN** the system SHALL create a Kimi AI model configuration
- **AND** SHALL set the API key to `sk-kimi-NFr9OldbRTRzzyFCJbNTozG1LPP9yb90Uas7AomC4Lz57OomFPk7115ZhDSBHmlJ`
- **AND** SHALL set the base URL to `https://api.kimi.com/coding/`
- **AND** SHALL set the model to `kimi-for-coding`
- **AND** SHALL set the status to `active`
- **AND** SHALL set the model as default
- **AND** SHALL make the model available in `/admin/ai-models` interface

#### Scenario: Model Appears in Admin Interface
- **WHEN** an administrator accesses `/admin/ai-models`
- **THEN** the system SHALL display the Kimi model configuration
- **AND** SHALL show the model as default
- **AND** SHALL show the model status as active
- **AND** SHALL allow testing the model connection
