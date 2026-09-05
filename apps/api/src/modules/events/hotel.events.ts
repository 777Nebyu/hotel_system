export const HotelEventNames = {
  APPROVED: 'hotel.approved',
  SUSPENDED: 'hotel.suspended',
} as const;

export class HotelApprovedEvent {
  constructor(
    public readonly hotelId: string,
    public readonly managerId: string | null,
  ) {}
}

export class HotelSuspendedEvent {
  constructor(
    public readonly hotelId: string,
    public readonly reason?: string,
  ) {}
}
