/**
 * Port for publishing domain events (implemented in infrastructure).
 */
export interface IEventPublisher {
  publish<T>(event: T): Promise<void>
  publishSync<T>(event: T): Promise<void>
}
