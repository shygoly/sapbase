import {
  applyDefinitionPatch,
  bumpPatchVersion,
  DefinitionPatchError,
  type DefinitionPatch,
} from './definition-patch.service'

function baseDefinition(): Record<string, unknown> {
  return {
    objectModel: {
      entities: [
        {
          identifier: 'Ticket',
          fields: [{ name: 'title', type: 'string', required: true }],
        },
      ],
    },
    relationships: { relationships: [] },
    stateFlow: {
      states: [
        { name: 'draft', initial: true },
        { name: 'closed', final: true },
      ],
      transitions: [{ from: 'draft', to: 'closed' }],
    },
    pages: { pages: [] },
    permissions: { rules: [] },
    reports: { reports: [] },
  }
}

function patch(overrides: Partial<DefinitionPatch>): DefinitionPatch {
  return {
    scope: 'object',
    operation: 'add',
    target: { identifier: 'Ticket' },
    payload: {},
    ...overrides,
  }
}

describe('applyDefinitionPatch', () => {
  it('adds, updates and removes a field without mutating the input', () => {
    const original = baseDefinition()
    const before = JSON.stringify(original)

    const added = applyDefinitionPatch(
      original,
      patch({ payload: { field: { name: 'priority', type: 'number' } } }),
    )
    expect((added.definition.objectModel as any).entities[0].fields).toEqual([
      { name: 'title', type: 'string', required: true },
      { name: 'priority', type: 'number' },
    ])

    const updated = applyDefinitionPatch(
      added.definition,
      patch({ operation: 'update', payload: { field: { name: 'priority', required: true } } }),
    )
    expect((updated.definition.objectModel as any).entities[0].fields[1]).toEqual({
      name: 'priority',
      type: 'number',
      required: true,
    })

    const removed = applyDefinitionPatch(
      updated.definition,
      patch({ operation: 'remove', target: { identifier: 'Ticket', path: 'fields.priority' } }),
    )
    expect((removed.definition.objectModel as any).entities[0].fields).toEqual([
      { name: 'title', type: 'string', required: true },
    ])
    expect(JSON.stringify(original)).toBe(before)
  })

  it('adds a state and its transitions, then removes the state', () => {
    const added = applyDefinitionPatch(
      baseDefinition(),
      patch({
        scope: 'state',
        payload: { state: { name: 'review', transitions: ['closed'] } },
      }),
    )
    const stateFlow = added.definition.stateFlow as any
    expect(stateFlow.states.map((state: any) => state.name)).toEqual([
      'draft',
      'closed',
      'review',
    ])
    expect(stateFlow.transitions).toEqual(
      expect.arrayContaining([{ from: 'review', to: 'closed' }]),
    )

    const removed = applyDefinitionPatch(
      added.definition,
      patch({ scope: 'state', operation: 'remove', payload: { state: { name: 'review' } } }),
    )
    expect((removed.definition.stateFlow as any).states.map((state: any) => state.name)).toEqual([
      'draft',
      'closed',
    ])
    expect((removed.definition.stateFlow as any).transitions).toEqual([
      { from: 'draft', to: 'closed' },
    ])
  })

  it('rejects unsupported scopes instead of silently ignoring them', () => {
    for (const scope of ['page', 'permission', 'menu'] as const) {
      expect(() => applyDefinitionPatch(baseDefinition(), patch({ scope }))).toThrow(
        DefinitionPatchError,
      )
    }
  })

  it('enforces L3 and L2 confirmation', () => {
    expect(() =>
      applyDefinitionPatch(baseDefinition(), patch({ securityLevel: 'L3' })),
    ).toThrow(/L3/)
    expect(() =>
      applyDefinitionPatch(
        baseDefinition(),
        patch({ securityLevel: 'L2', payload: { field: { name: 'x', type: 'string' } } }),
      ),
    ).toThrow(/confirmed/)
    expect(() =>
      applyDefinitionPatch(
        baseDefinition(),
        patch({ securityLevel: 'L2', payload: { field: { name: 'x', type: 'string' } } }),
        {
        confirmed: true,
      }),
    ).not.toThrow()
  })

  it('rejects missing entities/fields and duplicate additions', () => {
    expect(() =>
      applyDefinitionPatch(
        baseDefinition(),
        patch({ payload: { field: { name: 'x', type: 'string' } }, target: { identifier: 'Nope' } }),
      ),
    ).toThrow(/实体不存在/)
    expect(() =>
      applyDefinitionPatch(
        baseDefinition(),
        patch({ operation: 'update', payload: { field: { name: 'nope', type: 'string' } } }),
      ),
    ).toThrow(/字段不存在/)
    expect(() =>
      applyDefinitionPatch(
        baseDefinition(),
        patch({ payload: { field: { name: 'title', type: 'string' } } }),
      ),
    ).toThrow(/字段已存在/)
  })
})

describe('bumpPatchVersion', () => {
  it('bumps only the patch segment', () => {
    expect(bumpPatchVersion('1.2.3')).toBe('1.2.4')
  })

  it('rejects a non-semver version', () => {
    expect(() => bumpPatchVersion('v1')).toThrow(DefinitionPatchError)
  })
})
