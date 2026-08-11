import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BookingCreatedEvent, BookingEventNames } from './booking.events';
import { PaymentCompletedEvent, PaymentEventNames } from './payment.events';
import { ReviewEventNames, ReviewSubmittedEvent } from './review.events';

@Injectable()
export class DomainEventsListener {
  private readonly logger = new Logger(DomainEventsListener.name);

  @OnEvent(BookingEventNames.CREATED)
  handleBookingCreated(event: BookingCreatedEvent) {
    this.logger.log(`booking.created received for booking ${event.bookingId}`, {
      event,
    });
  }

  @OnEvent(PaymentEventNames.COMPLETED)
  handlePaymentCompleted(event: PaymentCompletedEvent) {
    this.logger.log(
      `payment.completed received for booking ${event.bookingId}`,
      { event },
    );
  }

  @OnEvent(ReviewEventNames.SUBMITTED)
  handleReviewSubmitted(event: ReviewSubmittedEvent) {
    this.logger.log(`review.submitted received for review ${event.reviewId}`, {
      event,
    });
  }
}
