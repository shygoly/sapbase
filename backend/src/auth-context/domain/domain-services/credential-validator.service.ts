import { DomainError } from '../errors'

/**
 * Domain service: Validate credential format (pure function).
 */
export class CredentialValidator {
  static validateEmail(email: string): void {
    if (!email || email.trim().length === 0) {
      throw new DomainError('Email cannot be empty')
    }
    if (!email.includes('@')) {
      throw new DomainError('Invalid email format')
    }
  }

  static validatePassword(password: string): void {
    if (!password || password.length === 0) {
      throw new DomainError('Password cannot be empty')
    }
    if (password.length < 6) {
      throw new DomainError('Password must be at least 6 characters')
    }
  }

  static validate(email: string, password: string): void {
    this.validateEmail(email)
    this.validatePassword(password)
  }
}
