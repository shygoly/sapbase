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
 * Create a mock repository with common methods.
 *
 * ⚠️ 这个替身是"按方法名列表"建的，因此**会随接口漂移**：接口加了方法而这里没加，
 * 用它的 spec 就会在运行时报 `Cannot read properties of undefined`（整仓红灯里有一批就是这个）。
 * 本次补齐了当前各仓储接口用到的方法集；长期修法是给每个接口一个**带类型的工厂**
 * （`jest.Mocked<IOrganizationRepository>`），接口一变就在编译期报错 —— 见 change
 * `restore-green-backend-tests` 的 tasks.md。
 */
export function createMockRepository<T = any>() {
  return {
    // 通用
    findById: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    // organization-context：三个仓储接口的专有查询
    findBySlug: jest.fn(),
    findByOrganization: jest.fn(),
    findByOrganizationAndUser: jest.fn(),
    findByOrganizationAndEmail: jest.fn(),
    findByToken: jest.fn(),
    countByOrganizationAndRole: jest.fn(),
    // auth-context：用户仓储按邮箱查
    findByEmail: jest.fn(),
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
