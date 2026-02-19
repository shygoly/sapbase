// Kimi API client for AI-powered patch generation
// Compatible with Anthropic API format

interface KimiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface KimiRequest {
  model: string
  messages: KimiMessage[]
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

interface KimiResponse {
  id: string
  type: string
  role: string
  content: Array<{
    type: string
    text: string
  }>
  model: string
  stop_reason: string | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Kimi API Client
 */
export class KimiClient {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(
    apiKey?: string,
    baseUrl?: string,
    model: string = 'moonshot-v1-8k'
  ) {
    this.apiKey = apiKey || process.env.KIMI_API_KEY || ''
    this.baseUrl = baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.kimi.com/coding/'
    this.model = model

    if (!this.apiKey) {
      // Kimi API key not configured
    }
  }

  /**
   * Generate patch JSON from natural language intent
   */
  async generatePatch(intent: string, context?: {
    currentSchema?: any
    constraints?: string[]
    targetSchema?: string
  }): Promise<string> {
    const systemPrompt = this.buildSystemPrompt()
    const userPrompt = this.buildUserPrompt(intent, context)

    const messages: KimiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    try {
      const response = await this.callAPI(messages)
      return this.extractPatchJSON(response)
    } catch (error) {
      throw new Error(`Failed to generate patch: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Call Kimi API
   */
  private async callAPI(messages: KimiMessage[]): Promise<KimiResponse> {
    if (!this.apiKey) {
      throw new Error('Kimi API key not configured')
    }

    const request: KimiRequest = {
      model: this.model,
      messages,
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more structured output
    }

    const response = await fetch(`${this.baseUrl}v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Kimi API error: ${response.status} ${errorText}`)
    }

    return await response.json()
  }

  /**
   * Build system prompt for patch generation
   */
  private buildSystemPrompt(): string {
    return `You are an AI assistant that generates Patch DSL JSON documents for modifying schemas in a declarative way.

Your task is to convert natural language requests into valid Patch DSL JSON documents.

Patch DSL Structure:
{
  "version": "1.0",
  "patchId": "uuid",
  "timestamp": "ISO-8601",
  "actor": "ai",
  "scope": "page | object | permission | state | menu",
  "operation": "add | update | remove | reorder | replace",
  "target": {
    "type": "page | object | field | action | state | role | menu",
    "identifier": "schema name"
  },
  "payload": { ... },
  "description": "human-readable description"
}

Scopes:
- "object": Modify object schemas (fields, relations)
- "page": Modify page structure (columns, actions)
- "permission": Modify permissions
- "state": Modify state machines
- "menu": Modify navigation

Operations:
- "add": Add new element
- "update": Modify existing element
- "remove": Remove element
- "reorder": Change order
- "replace": Replace entire element

Always return ONLY valid JSON, no markdown, no explanations, just the patch JSON object.`
  }

  /**
   * Build user prompt with intent and context
   */
  private buildUserPrompt(intent: string, context?: {
    currentSchema?: any
    constraints?: string[]
    targetSchema?: string
  }): string {
    let prompt = `Generate a Patch DSL JSON document for the following request:\n\n"${intent}"\n\n`

    if (context?.targetSchema) {
      prompt += `Target schema: ${context.targetSchema}\n\n`
    }

    if (context?.currentSchema) {
      prompt += `Current schema:\n${JSON.stringify(context.currentSchema, null, 2)}\n\n`
    }

    if (context?.constraints && context.constraints.length > 0) {
      prompt += `Constraints:\n${context.constraints.map(c => `- ${c}`).join('\n')}\n\n`
    }

    prompt += `Return ONLY the Patch JSON object, no markdown formatting, no code blocks, just the JSON.`

    return prompt
  }

  /**
   * Extract patch JSON from API response
   */
  private extractPatchJSON(response: KimiResponse): string {
    if (!response.content || response.content.length === 0) {
      throw new Error('Empty response from Kimi API')
    }

    const text = response.content[0]?.text || ''
    
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/(\{[\s\S]*\})/)
    
    if (jsonMatch) {
      return jsonMatch[1].trim()
    }

    // If no code block, try to parse the entire text as JSON
    try {
      JSON.parse(text)
      return text.trim()
    } catch {
      throw new Error('Could not extract valid JSON from API response')
    }
  }

  /**
   * Generate UUID for patch ID
   */
  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}
