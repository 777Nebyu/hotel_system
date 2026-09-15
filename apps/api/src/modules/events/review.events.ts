export const ReviewEventNames = {
  SUBMITTED: 'review.submitted',
  EDITED: 'review.edited',
  DELETED: 'review.deleted',
} as const;

export class ReviewSubmittedEvent {
  constructor(
    public readonly reviewId: string,
    public readonly userId: string,
    public readonly hotelId: string,
    public readonly rating: number,
  ) {}
}

export class ReviewEditedEvent {
  constructor(
    public readonly reviewId: string,
    public readonly userId: string,
    public readonly hotelId: string,
    public readonly rating: number,
  ) {}
}

export class ReviewDeletedEvent {
  constructor(
    public readonly reviewId: string,
    public readonly userId: string,
    public readonly hotelId: string,
  ) {}
}
