import { DomainError } from './domain-error'

/**
 * Thrown when a business rule is violated (e.g. cannot publish unapproved module, invalid status transition).
 */
export class BusinessRuleViolation extends DomainError {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessRuleViolation'
    Object.setPrototypeOf(this, BusinessRuleViolation.prototype)
  }
}
