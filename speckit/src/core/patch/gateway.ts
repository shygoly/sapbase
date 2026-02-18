// AI Tool Gateway interface for patch generation
import type {
  PatchGenerationRequest,
  PatchGenerationResponse,
  Patch,
  SecurityLevel,
} from './types'
import { PatchManager } from './patch-manager'
import { PatchValidator } from './validator'
import { KimiClient } from '@/lib/ai/kimi-client'

/**
 * AI Gateway for generating patches from natural language intent
 */
export class PatchGateway {
  private patchManager: PatchManager
  private validator: PatchValidator
  private kimiClient: KimiClient | null = null

  constructor(patchManager: PatchManager, kimiClient?: KimiClient) {
    this.patchManager = patchManager
    // Access validator through patch manager's schema registry
    this.validator = new PatchValidator(patchManager.schemaRegistry)
    
    // Initialize Kimi client if API key is available
    try {
      this.kimiClient = kimiClient || new KimiClient()
    } catch (error) {
      console.warn('Kimi client not available, falling back to pattern matching')
    }
  }

  /**
   * Generate a patch from natural language intent
   * Uses Kimi API if available, otherwise falls back to pattern matching
   */
  async generatePatch(
    request: PatchGenerationRequest
  ): Promise<PatchGenerationResponse> {
    let patch: Patch

    // Try to use Kimi API if available
    if (this.kimiClient) {
      try {
        const patchJSON = await this.kimiClient.generatePatch(
          request.intent,
          request.context
        )
        patch = JSON.parse(patchJSON) as Patch
        
        // Ensure required fields are set
        patch.patchId = patch.patchId || this.kimiClient.generateUUID()
        patch.timestamp = patch.timestamp || new Date().toISOString()
        patch.actor = patch.actor || 'ai'
        patch.version = patch.version || '1.0'
      } catch (error) {
        console.warn('Kimi API failed, falling back to pattern matching:', error)
        // Fall back to pattern matching
        patch = this.parseIntentToPatch(request)
      }
    } else {
      // Fall back to pattern matching
      patch = this.parseIntentToPatch(request)
    }

    // Validate the generated patch
    const validation = this.validator.validate(patch)

    // Perform dry run
    const dryRunResult = await this.patchManager.dryRun(patch)

    return {
      patch,
      explanation: this.generateExplanation(patch, request.intent),
      securityLevel: validation.securityLevel,
      dryRunResult: {
        valid: dryRunResult.valid,
        changes: dryRunResult.changes,
        warnings: dryRunResult.warnings,
      },
    }
  }

  /**
   * Parse natural language intent to patch structure
   * This is a simplified parser - real implementation would use AI
   */
  private parseIntentToPatch(request: PatchGenerationRequest): Patch {
    const intent = request.intent.toLowerCase()
    const now = new Date().toISOString()
    const patchId = this.generateUUID()

    // Simple pattern matching (in production, use AI/LLM)
    if (intent.includes('add field') || intent.includes('add column')) {
      return this.createAddFieldPatch(intent, request, patchId, now)
    }

    if (intent.includes('remove field') || intent.includes('delete field')) {
      return this.createRemoveFieldPatch(intent, request, patchId, now)
    }

    if (intent.includes('update field') || intent.includes('modify field')) {
      return this.createUpdateFieldPatch(intent, request, patchId, now)
    }

    if (intent.includes('permission') || intent.includes('access')) {
      return this.createPermissionPatch(intent, request, patchId, now)
    }

    // Default: generic patch
    return {
      version: '1.0',
      patchId,
      timestamp: now,
      actor: 'ai',
      scope: 'object',
      operation: 'add',
      target: {
        type: 'object',
        identifier: request.context.targetSchema || 'unknown',
      },
      payload: {},
      description: request.intent,
    }
  }

  /**
   * Create add field patch
   */
  private createAddFieldPatch(
    intent: string,
    request: PatchGenerationRequest,
    patchId: string,
    timestamp: string
  ): Patch {
    // Extract field name from intent (simplified)
    const fieldMatch = intent.match(/field\s+['"]?(\w+)['"]?/i)
    const fieldName = fieldMatch ? fieldMatch[1] : 'newField'

    return {
      version: '1.0',
      patchId,
      timestamp,
      actor: 'ai',
      scope: 'object',
      operation: 'add',
      target: {
        type: 'field',
        identifier: request.context.targetSchema || 'unknown',
      },
      payload: {
        field: {
          name: fieldName,
          label: this.capitalize(fieldName),
          type: 'text', // Default type
          required: false,
        },
      },
      description: request.intent,
    }
  }

  /**
   * Create remove field patch
   */
  private createRemoveFieldPatch(
    intent: string,
    request: PatchGenerationRequest,
    patchId: string,
    timestamp: string
  ): Patch {
    const fieldMatch = intent.match(/field\s+['"]?(\w+)['"]?/i)
    const fieldName = fieldMatch ? fieldMatch[1] : 'fieldToRemove'

    return {
      version: '1.0',
      patchId,
      timestamp,
      actor: 'ai',
      scope: 'object',
      operation: 'remove',
      target: {
        type: 'field',
        identifier: request.context.targetSchema || 'unknown',
      },
      payload: {
        field: {
          name: fieldName,
        },
      },
      description: request.intent,
    }
  }

  /**
   * Create update field patch
   */
  private createUpdateFieldPatch(
    intent: string,
    request: PatchGenerationRequest,
    patchId: string,
    timestamp: string
  ): Patch {
    const fieldMatch = intent.match(/field\s+['"]?(\w+)['"]?/i)
    const fieldName = fieldMatch ? fieldMatch[1] : 'fieldToUpdate'

    return {
      version: '1.0',
      patchId,
      timestamp,
      actor: 'ai',
      scope: 'object',
      operation: 'update',
      target: {
        type: 'field',
        identifier: request.context.targetSchema || 'unknown',
      },
      payload: {
        field: {
          name: fieldName,
          // Additional updates would be parsed from intent
        },
      },
      description: request.intent,
    }
  }

  /**
   * Create permission patch
   */
  private createPermissionPatch(
    intent: string,
    request: PatchGenerationRequest,
    patchId: string,
    timestamp: string
  ): Patch {
    return {
      version: '1.0',
      patchId,
      timestamp,
      actor: 'ai',
      scope: 'permission',
      operation: 'update',
      target: {
        type: 'role',
        identifier: 'default', // Would be parsed from intent
      },
      payload: {
        allow: [], // Would be parsed from intent
        deny: [],
      },
      description: request.intent,
    }
  }

  /**
   * Generate explanation for patch
   */
  private generateExplanation(patch: Patch, intent: string): string {
    return `This patch ${patch.operation}s a ${patch.target.type} in ${patch.scope} scope. Intent: ${intent}`
  }

  /**
   * Generate UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

/**
 * Helper functions for common patch generation patterns
 */
export const PatchHelpers = {
  /**
   * Create add field patch
   */
  createAddFieldPatch(
    objectName: string,
    fieldName: string,
    fieldType: string = 'text',
    options?: Partial<any>
  ): Patch {
    return {
      version: '1.0',
      patchId: generateUUID(),
      timestamp: new Date().toISOString(),
      actor: 'ai',
      scope: 'object',
      operation: 'add',
      target: {
        type: 'field',
        identifier: objectName,
      },
      payload: {
        field: {
          name: fieldName,
          label: capitalize(fieldName),
          type: fieldType,
          ...options,
        },
      },
    }
  },

  /**
   * Create update permission patch
   */
  createPermissionPatch(
    roleName: string,
    allow: string[],
    deny: string[] = []
  ): Patch {
    return {
      version: '1.0',
      patchId: generateUUID(),
      timestamp: new Date().toISOString(),
      actor: 'ai',
      scope: 'permission',
      operation: 'update',
      target: {
        type: 'role',
        identifier: roleName,
      },
      payload: {
        allow,
        deny,
      },
    }
  },
}

/**
 * Generate UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
