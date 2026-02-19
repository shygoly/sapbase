/**
 * Interface for event handlers.
 */
export interface IEventHandler<T> {
  handle(event: T): Promise<void> | void
}
