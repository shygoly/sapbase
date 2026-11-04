import type { DomainEvent } from '../../../common/events/domain-event'

export class BrandConfigUpdatedEvent implements DomainEvent {
  constructor(
    public readonly organizationId: string,
    public readonly configId: string,
    public readonly updatedFields: string[],
    public readonly occurredAt: Date = new Date(),
  ) {}
}
