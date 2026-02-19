# Change: Integrate Kimi API as AI Model for Patch Generation

## Why

The current Patch Gateway uses simple pattern matching to generate patches from natural language. To enable true AI-driven patch generation, we need to integrate with a real AI model API. Kimi provides a compatible API endpoint that can be used for generating structured patch JSON from natural language intents.

## What Changes

- **ADDED**: Kimi API client integration in Patch Gateway
- **ADDED**: Environment variable configuration for Kimi API key and base URL
- **MODIFIED**: Patch Gateway to use Kimi API for patch generation instead of pattern matching
- **ADDED**: Error handling and retry logic for API calls
- **ADDED**: API response parsing and validation

## Impact

- **Affected specs**: `patch-dsl-system` capability
- **Affected code**:
  - `speckit/src/core/patch/gateway.ts` - Add Kimi API integration
  - `speckit/src/lib/ai/kimi-client.ts` - New Kimi API client
  - `.env.example` - Add Kimi API configuration
- **Breaking changes**: None (additive only)

## Configuration

Environment variables:
- `KIMI_API_KEY=sk-kimi-NFr9OldbRTRzzyFCJbNTozG1LPP9yb90Uas7AomC4Lz57OomFPk7115ZhDSBHmlJ`
- `ANTHROPIC_BASE_URL=https://api.kimi.com/coding/`

## Success Criteria

- ✅ Patch Gateway can generate patches using Kimi API
- ✅ API responses are properly parsed and validated
- ✅ Error handling works correctly for API failures
- ✅ Generated patches conform to Patch DSL schema
- ✅ Integration works with existing Patch Manager

## Implementation Status

- ✅ Created `speckit/src/lib/ai/kimi-client.ts` - Kimi API client
- ✅ Updated `speckit/src/core/patch/gateway.ts` - Integrated Kimi client
- ✅ Added environment variables to `.env.example`
- ✅ Fallback to pattern matching if API unavailable
- ✅ Error handling and retry logic implemented
