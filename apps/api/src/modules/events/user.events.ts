export const UserEventNames = {
  REGISTERED: 'user.registered',
} as const;

export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly fullName: string,
    public readonly verificationToken: string,
  ) {}
}
