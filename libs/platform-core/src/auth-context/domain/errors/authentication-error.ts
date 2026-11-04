import { DomainError } from './domain-error'

/**
 * Thrown when authentication fails (e.g. invalid credentials, expired token).
 */
export class AuthenticationError extends DomainError {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
    Object.setPrototypeOf(this, AuthenticationError.prototype)
  }
}
