/**
 * Domain event: a user logged in.
 */
export class UserLoggedInEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly organizationId: string | undefined,
    public readonly loggedInAt: Date,
  ) {}
}
