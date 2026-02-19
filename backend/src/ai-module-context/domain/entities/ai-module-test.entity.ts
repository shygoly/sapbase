import { DomainError } from '../errors'

export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Domain entity: AIModuleTest (pure, no TypeORM).
 */
export class AIModuleTest {
  private constructor(
    public readonly id: string,
    public readonly moduleId: string,
    public readonly testName: string,
    public readonly entityType: string,
    private _status: TestStatus,
    private _errorMessage: string | null,
    private _testData: Record<string, any> | null,
    private _result: Record<string, any> | null,
    private _executedAt: Date | null,
    private _duration: number | null,
  ) {}

  get status(): TestStatus {
    return this._status
  }

  get errorMessage(): string | null {
    return this._errorMessage
  }

  get testData(): Record<string, any> | null {
    return this._testData
  }

  get result(): Record<string, any> | null {
    return this._result
  }

  get executedAt(): Date | null {
    return this._executedAt
  }

  get duration(): number | null {
    return this._duration
  }

  /** Reconstruct from persistence (no validation). */
  static fromPersistence(
    id: string,
    moduleId: string,
    testName: string,
    entityType: string,
    status: TestStatus,
    errorMessage: string | null,
    testData: Record<string, any> | null,
    result: Record<string, any> | null,
    executedAt: Date | null,
    duration: number | null,
  ): AIModuleTest {
    return new AIModuleTest(
      id,
      moduleId,
      testName,
      entityType,
      status,
      errorMessage,
      testData,
      result,
      executedAt,
      duration,
    )
  }

  static create(
    moduleId: string,
    testName: string,
    entityType: string,
  ): AIModuleTest {
    if (!testName || testName.trim().length === 0) {
      throw new DomainError('Test name cannot be empty')
    }
    if (!entityType || entityType.trim().length === 0) {
      throw new DomainError('Entity type cannot be empty')
    }

    return new AIModuleTest(
      '', // ID assigned by repository
      moduleId,
      testName.trim(),
      entityType.trim(),
      TestStatus.PENDING,
      null,
      null,
      null,
      null,
      null,
    )
  }

  start(): void {
    if (this._status !== TestStatus.PENDING) {
      throw new DomainError('Test can only be started if it is pending')
    }
    this._status = TestStatus.RUNNING
  }

  complete(result: Record<string, any>, duration: number): void {
    if (this._status !== TestStatus.RUNNING) {
      throw new DomainError('Test can only be completed if it is running')
    }
    this._status = TestStatus.PASSED
    this._result = result
    this._executedAt = new Date()
    this._duration = duration
  }

  fail(errorMessage: string, duration: number): void {
    if (this._status !== TestStatus.RUNNING) {
      throw new DomainError('Test can only fail if it is running')
    }
    this._status = TestStatus.FAILED
    this._errorMessage = errorMessage
    this._executedAt = new Date()
    this._duration = duration
  }

  skip(): void {
    this._status = TestStatus.SKIPPED
  }
}
