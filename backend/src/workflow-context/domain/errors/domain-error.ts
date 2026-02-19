/**
 * Base domain error for workflow context.
 * Domain layer only - no infrastructure dependencies.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
    Object.setPrototypeOf(this, DomainError.prototype)
  }
}
