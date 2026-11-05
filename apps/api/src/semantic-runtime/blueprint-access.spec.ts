import {
  canAccessBlueprintPage,
  canAccessBlueprintResource,
  type BlueprintPermissionsLayer,
} from '@sap/shared-core'

const layer: BlueprintPermissionsLayer = {
  permissions: 'blueprint-permissions/v1',
  rules: [
    { role: 'sales', scope: 'own', resources: ['Ticket'], actions: ['read', 'list'] },
    { role: 'manager', scope: 'all', resources: ['*'] },
    { role: 'auditor', scope: 'all', resources: ['Ticket'], actions: ['read'] },
  ],
  roleMappings: { auditor: ['audit:read'] },
}

describe('Blueprint permission access', () => {
  it('allows when there is no layer', () => {
    expect(canAccessBlueprintResource(null, { role: 'member' }, 'Ticket', 'read')).toBe(true)
  })

  it('matches a JWT role', () => {
    expect(
      canAccessBlueprintResource(layer, { role: 'sales', permissions: [] }, 'Ticket', 'read'),
    ).toBe(true)
    expect(
      canAccessBlueprintResource(layer, { role: 'sales', permissions: [] }, 'Order', 'read'),
    ).toBe(false)
  })

  it('matches a mapped platform permission point', () => {
    expect(
      canAccessBlueprintResource(
        layer,
        { role: 'member', permissions: ['audit:read'] },
        'Ticket',
        'read',
      ),
    ).toBe(true)
  })

  it('enforces action and wildcard resources', () => {
    expect(
      canAccessBlueprintResource(layer, { role: 'sales', permissions: [] }, 'Ticket', 'delete'),
    ).toBe(false)
    expect(
      canAccessBlueprintResource(layer, { role: 'manager', permissions: [] }, 'Anything', 'delete'),
    ).toBe(true)
  })

  it('page access is read access', () => {
    expect(
      canAccessBlueprintPage(layer, { role: 'sales', permissions: [] }, 'Ticket'),
    ).toBe(true)
    expect(
      canAccessBlueprintPage(layer, { role: 'nobody', permissions: [] }, 'Ticket'),
    ).toBe(false)
  })
})
