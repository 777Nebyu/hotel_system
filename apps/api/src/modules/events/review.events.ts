export const ReviewEventNames = {
  SUBMITTED: 'review.submitted',
} as const;

export class ReviewSubmittedEvent {
  constructor(
    public readonly reviewId: string,
    public readonly userId: string,
    public readonly hotelId: string,
    public readonly rating: number,
  ) {}
}
