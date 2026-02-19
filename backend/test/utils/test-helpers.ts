import { v4 as uuidv4 } from 'uuid'

/**
 * Test helper utilities for creating test data.
 */

/**
 * Create a mock user ID
 */
export function createMockUserId(): string {
  return `user-${uuidv4()}`
}

/**
 * Create a mock organization ID
 */
export function createMockOrganizationId(): string {
  return `org-${uuidv4()}`
}

/**
 * Create a mock workflow definition ID
 */
export function createMockWorkflowDefinitionId(): string {
  return `wf-${uuidv4()}`
}

/**
 * Create a mock workflow instance ID
 */
export function createMockWorkflowInstanceId(): string {
  return `instance-${uuidv4()}`
}

/**
 * Create a mock date
 */
export function createMockDate(daysOffset: number = 0): Date {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return date
}

/**
 * Create a mock email
 */
export function createMockEmail(prefix: string = 'test'): string {
  return `${prefix}-${uuidv4().substring(0, 8)}@example.com`
}

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Create a mock repository with common methods
 */
export function createMockRepository<T = any>() {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  } as any
}

/**
 * Create a mock event publisher
 */
export function createMockEventPublisher() {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    publishSync: jest.fn().mockResolvedValue(undefined),
  }
}

/**
 * Reset all mocks
 */
export function resetAllMocks() {
  jest.clearAllMocks()
}

/**
 * Create a mock command/query
 */
export function createMockCommand<T extends Record<string, any>>(
  overrides?: Partial<T>,
): T {
  return {
    ...overrides,
  } as T
}
