# Kimi API Integration Specification

## ADDED Requirements

### Requirement: Kimi API Integration
The system SHALL integrate with Kimi API for AI-powered patch generation.

#### Scenario:
- **WHEN** a user requests patch generation via natural language
- **THEN** the system SHALL call Kimi API with the intent and context
- **AND** the API response SHALL be parsed to extract Patch JSON
- **AND** the generated patch SHALL be validated before returning
- **AND** if API call fails, the system SHALL fall back to pattern matching

### Requirement: Environment Configuration
The system SHALL support Kimi API configuration via environment variables.

#### Scenario:
- **WHEN** the application starts
- **THEN** the system SHALL read KIMI_API_KEY from environment
- **AND** SHALL read ANTHROPIC_BASE_URL from environment
- **AND** SHALL initialize KimiClient with these values
- **AND** if API key is missing, SHALL log a warning and disable AI features

### Requirement: Error Handling
The system SHALL handle API errors gracefully.

#### Scenario:
- **WHEN** Kimi API returns an error
- **THEN** the system SHALL catch the error
- **AND** SHALL log the error details
- **AND** SHALL fall back to pattern matching
- **AND** SHALL return a valid PatchGenerationResponse with fallback patch

### Requirement: Response Parsing
The system SHALL parse Kimi API responses correctly.

#### Scenario:
- **WHEN** Kimi API returns a response
- **THEN** the system SHALL extract JSON from markdown code blocks if present
- **AND** SHALL parse the JSON to create a Patch object
- **AND** SHALL ensure required fields (patchId, timestamp, actor, version) are set
- **AND** SHALL validate the patch structure before returning
