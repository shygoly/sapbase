import { BadRequestException } from '@nestjs/common'
import {
  assertDefinitionStep,
  assertMergedDefinition,
  validateDefinitionStep,
} from './definition-schema'

const OBJECT_MODEL = {
  entities: [
    {
      identifier: 'Lead',
      fields: [{ name: 'name', type: 'string', required: true }],
    },
  ],
}

const STATE_FLOW = {
  states: [
    { name: 'draft', initial: true },
    { name: 'closed', final: true },
  ],
  transitions: [{ from: 'draft', to: 'closed' }],
}

describe('definition schema', () => {
  it('accepts a valid object model', () => {
    expect(validateDefinitionStep('object-model', OBJECT_MODEL)).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('rejects an unsupported field type with a path', () => {
    const result = validateDefinitionStep('object-model', {
      entities: [{ identifier: 'Lead', fields: [{ name: 'name', type: 'sql' }] }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('type')
  })

  it('accepts both state-flow formats', () => {
    expect(validateDefinitionStep('state-flow', STATE_FLOW).valid).toBe(true)
    expect(
      validateDefinitionStep('state-flow', {
        states: [{ name: 'draft', initial: true, transitions: ['closed'] }],
      }).valid,
    ).toBe(true)
  })

  it('validates permissions scope and reports entity names', () => {
    expect(
      validateDefinitionStep('permissions', {
        rules: [{ role: 'sales', scope: 'everything', resources: ['Lead'] }],
      }).valid,
    ).toBe(false)
    expect(
      validateDefinitionStep('reports', {
        reports: [{ identifier: 'pipeline', entities: ['lead'] }],
      }).valid,
    ).toBe(false)
  })

  it('throws BadRequestException with step id and errors', () => {
    try {
      assertDefinitionStep('object-model', { entities: [] })
      throw new Error('expected validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ stepId: 'object-model' }),
      )
    }
  })

  it('validates every present step but skips missing steps', () => {
    expect(() => assertMergedDefinition({ objectModel: OBJECT_MODEL })).not.toThrow()
    expect(() =>
      assertMergedDefinition({
        objectModel: OBJECT_MODEL,
        stateFlow: { states: [] },
      }),
    ).toThrow(BadRequestException)
  })
})
