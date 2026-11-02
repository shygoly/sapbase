import { A2_ALLOWED_CHANGE_CLASSES, A2_FORBIDDEN_CHANGE_CLASSES } from './release-automation.service'

describe('A2 whitelist', () => {
  it('allows only low-risk classes', () => {
    expect(A2_ALLOWED_CHANGE_CLASSES).toContain('copy')
    expect(A2_ALLOWED_CHANGE_CLASSES).toContain('knowledge_instruction')
    expect(A2_FORBIDDEN_CHANGE_CLASSES).toEqual(
      expect.arrayContaining(['data', 'flow', 'permission', 'agent', 'migration']),
    )
  })
})
