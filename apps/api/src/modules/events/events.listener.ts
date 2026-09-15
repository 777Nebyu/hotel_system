import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BookingCancelledEvent,
  BookingCheckedInEvent,
  BookingCheckedOutEvent,
  BookingCreatedEvent,
  BookingEventNames,
  BookingModifiedEvent,
  BookingNoShowEvent,
} from './booking.events';
import {
  PaymentCompletedEvent,
  PaymentEventNames,
  PaymentFailedEvent,
  PaymentRefundedEvent,
} from './payment.events';
import {
  ReviewDeletedEvent,
  ReviewEditedEvent,
  ReviewEventNames,
  ReviewSubmittedEvent,
} from './review.events';
import {
  HotelApprovedEvent,
  HotelEventNames,
  HotelSuspendedEvent,
} from './hotel.events';
import { UserEventNames, UserRegisteredEvent } from './user.events';

@Injectable()
export class DomainEventsListener {
  private readonly logger = new Logger(DomainEventsListener.name);

  @OnEvent(BookingEventNames.CREATED)
  handleBookingCreated(event: BookingCreatedEvent) {
    this.logger.log(`booking.created received for booking ${event.bookingId}`, {
      event,
    });
  }

  @OnEvent(BookingEventNames.CANCELLED)
  handleBookingCancelled(event: BookingCancelledEvent) {
    this.logger.log(`booking.cancelled received for booking ${event.bookingId}`, {
      event,
    });
  }

  @OnEvent(BookingEventNames.MODIFIED)
  handleBookingModified(event: BookingModifiedEvent) {
    this.logger.log(`booking.modified received for booking ${event.bookingId}`, {
      event,
    });
  }

  @OnEvent(BookingEventNames.CHECKED_IN)
  handleBookingCheckedIn(event: BookingCheckedInEvent) {
    this.logger.log(`booking.checked_in received for booking ${event.bookingId}`, {
      event,
    });
  }

  @OnEvent(BookingEventNames.CHECKED_OUT)
  handleBookingCheckedOut(event: BookingCheckedOutEvent) {
    this.logger.log(`booking.checked_out received for booking ${event.bookingId}`, {
      event,
    });
  }

  @OnEvent(BookingEventNames.NO_SHOW)
  handleBookingNoShow(event: BookingNoShowEvent) {
    this.logger.log(`booking.no_show received for booking ${event.bookingId}`, {
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

  @OnEvent(PaymentEventNames.REFUNDED)
  handlePaymentRefunded(event: PaymentRefundedEvent) {
    this.logger.log(
      `payment.refunded received for booking ${event.bookingId}`,
      { event },
    );
  }

  @OnEvent(PaymentEventNames.FAILED)
  handlePaymentFailed(event: PaymentFailedEvent) {
    this.logger.warn(
      `payment.failed received for booking ${event.bookingId}`,
      { event },
    );
  }

  @OnEvent(ReviewEventNames.SUBMITTED)
  handleReviewSubmitted(event: ReviewSubmittedEvent) {
    this.logger.log(`review.submitted received for review ${event.reviewId}`, {
      event,
    });
  }

  @OnEvent(ReviewEventNames.EDITED)
  handleReviewEdited(event: ReviewEditedEvent) {
    this.logger.log(`review.edited received for review ${event.reviewId}`, {
      event,
    });
  }

  @OnEvent(ReviewEventNames.DELETED)
  handleReviewDeleted(event: ReviewDeletedEvent) {
    this.logger.log(`review.deleted received for review ${event.reviewId}`, {
      event,
    });
  }

  @OnEvent(HotelEventNames.APPROVED)
  handleHotelApproved(event: HotelApprovedEvent) {
    this.logger.log(`hotel.approved received for hotel ${event.hotelId}`, {
      event,
    });
  }

  @OnEvent(HotelEventNames.SUSPENDED)
  handleHotelSuspended(event: HotelSuspendedEvent) {
    this.logger.log(`hotel.suspended received for hotel ${event.hotelId}`, {
      event,
    });
  }

  @OnEvent(UserEventNames.REGISTERED)
  handleUserRegistered(event: UserRegisteredEvent) {
    this.logger.log(`user.registered received for user ${event.userId}`, {
      event,
    });
  }
}
