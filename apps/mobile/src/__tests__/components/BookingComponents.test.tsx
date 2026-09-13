/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: any) => React.createElement(View, { ...props, testID: 'mock-image' }),
  };
});

import {
  BookingStatusBadge,
  BookingTimeline,
  RoomCard,
  CancellationDialog,
  QRCodeModal,
  HoldTimer,
  AvailabilityAlert,
  PriceChangeAlert,
  RefundStatus,
  RefundTimeline,
  PriceBreakdown,
  PaymentStatusRow,
  BookingSummary,
} from '../../components/BookingComponents';

describe('BookingComponents', () => {
  describe('BookingStatusBadge', () => {
    it('renders CONFIRMED status badge', () => {
      const { getByText } = render(<BookingStatusBadge status="CONFIRMED" />);
      expect(getByText('Confirmed')).toBeTruthy();
    });

    it('renders PENDING status badge', () => {
      const { getByText } = render(<BookingStatusBadge status="PENDING" />);
      expect(getByText('Pending')).toBeTruthy();
    });

    it('renders CANCELLED status badge', () => {
      const { getByText } = render(<BookingStatusBadge status="CANCELLED" />);
      expect(getByText('Cancelled')).toBeTruthy();
    });
  });

  describe('BookingTimeline', () => {
    it('renders confirmed lifecycle milestones per BOOK.md §20', () => {
      const { getByText, unmount } = render(<BookingTimeline status="CONFIRMED" />);
      expect(getByText('Booking Confirmed')).toBeTruthy();
      expect(getByText('Check-in')).toBeTruthy();
      expect(getByText('Check-out')).toBeTruthy();
      unmount();
    });

    it('renders checked-in lifecycle milestones per BOOK.md §20', () => {
      const { getByText, unmount } = render(<BookingTimeline status="CHECKED_IN" />);
      expect(getByText('Booking Confirmed')).toBeTruthy();
      expect(getByText('Checked In')).toBeTruthy();
      expect(getByText('Check-out')).toBeTruthy();
      unmount();
    });

    it('renders checked-out lifecycle milestones per BOOK.md §20', () => {
      const { getByText, unmount } = render(<BookingTimeline status="CHECKED_OUT" />);
      expect(getByText('Booking Confirmed')).toBeTruthy();
      expect(getByText('Checked In')).toBeTruthy();
      expect(getByText('Checked Out')).toBeTruthy();
      unmount();
    });

    it('renders cancelled terminal state per BOOK.md §20', () => {
      const { getByText, unmount } = render(<BookingTimeline status="CANCELLED" />);
      expect(getByText('Booking Confirmed')).toBeTruthy();
      expect(getByText('Booking Cancelled')).toBeTruthy();
      unmount();
    });

    it('renders pending state milestones per BOOK.md §22', () => {
      const { getByText, unmount } = render(<BookingTimeline status="PENDING" />);
      expect(getByText('Booking Created')).toBeTruthy();
      expect(getByText('Booking Confirmed')).toBeTruthy();
      expect(getByText('Check-in')).toBeTruthy();
      expect(getByText('Check-out')).toBeTruthy();
      unmount();
    });
  });

  describe('RoomCard', () => {
    const mockRoom = {
      id: 'r1',
      roomNumber: '101',
      type: 'DELUXE',
      capacity: 2,
      beds: 1,
      bathroom: 1,
      basePrice: 1500,
      status: 'AVAILABLE',
      amenities: ['WiFi', 'Balcony', 'AC'],
    };

    it('renders room details and pricing per BOOK.md §8', () => {
      const { getByText } = render(
        <RoomCard
          room={mockRoom}
          hotelName="Grand Yaye Hotel"
          nights={2}
          onViewRoom={() => {}}
          onBookRoom={() => {}}
        />
      );
      expect(getByText('Deluxe')).toBeTruthy();
      expect(getByText('Grand Yaye Hotel')).toBeTruthy();
      expect(getByText('ETB 1,500')).toBeTruthy();
      expect(getByText('ETB 3,000 total (2 nights)')).toBeTruthy();
      expect(getByText('Available')).toBeTruthy();
      expect(getByText('View')).toBeTruthy();
      expect(getByText('Book Room')).toBeTruthy();
    });

    it('renders sold out label when status is not available', () => {
      const { getByText } = render(
        <RoomCard
          room={{ ...mockRoom, status: 'BOOKED' }}
          hotelName="Grand Yaye Hotel"
          onViewRoom={() => {}}
          onBookRoom={() => {}}
        />
      );
      expect(getByText('Sold out')).toBeTruthy();
      expect(getByText('Sold Out')).toBeTruthy();
    });
  });

  describe('CancellationDialog', () => {
    it('renders refund breakdown and buttons per BOOK.md §28', () => {
      const { getByText } = render(
        <CancellationDialog
          visible={true}
          hotelName="Grand Palace"
          bookingRef="YTH-12345"
          checkIn="2026-09-20"
          checkOut="2026-09-25"
          totalPrice={3000}
          cancellationHours={48}
          onConfirmCancel={() => {}}
          onKeepBooking={() => {}}
        />
      );
      expect(getByText('Cancel Reservation')).toBeTruthy();
      expect(getByText('Grand Palace')).toBeTruthy();
      expect(getByText('Keep Booking')).toBeTruthy();
      expect(getByText('Cancel Booking')).toBeTruthy();
    });
  });

  describe('QRCodeModal', () => {
    it('renders check-in QR code modal per BOOK.md §40', () => {
      const { getByText } = render(
        <QRCodeModal
          visible={true}
          bookingRef="YTH-998877"
          guestName="John Doe"
          hotelName="Grand Palace"
          checkIn="2026-09-20"
          checkOut="2026-09-25"
          onClose={() => {}}
        />
      );
      expect(getByText('Check-in QR Code')).toBeTruthy();
      expect(getByText('Show this QR code at hotel reception to check in.')).toBeTruthy();
      expect(getByText('YTH-998877')).toBeTruthy();
      expect(getByText('Share')).toBeTruthy();
      expect(getByText('Save')).toBeTruthy();
    });
  });

  describe('HoldTimer', () => {
    it('renders active hold timer message and pill per BOOK.md §10, §11', () => {
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const { getByText, unmount } = render(<HoldTimer expiresAt={expiresAt} />);
      expect(getByText('Room held')).toBeTruthy();
      expect(getByText('Complete your booking before the hold expires.')).toBeTruthy();
      unmount();
    });

    it('renders expired hold timer message with search CTA per BOOK.md §11', () => {
      const expiresAt = Date.now() - 1000;
      const onSearchAgain = jest.fn();
      const { getByText, unmount } = render(<HoldTimer expiresAt={expiresAt} onSearchAgain={onSearchAgain} />);
      expect(getByText('Your room hold has expired.')).toBeTruthy();
      expect(getByText('Search Available Rooms')).toBeTruthy();
      unmount();
    });
  });

  describe('AvailabilityAlert', () => {
    it('renders concurrency failure alert per BOOK.md §15', () => {
      const onViewOtherRooms = jest.fn();
      const onModifySearch = jest.fn();
      const { getByText } = render(
        <AvailabilityAlert
          visible={true}
          onViewOtherRooms={onViewOtherRooms}
          onModifySearch={onModifySearch}
        />
      );
      expect(getByText('Sorry, this room was just booked')).toBeTruthy();
      expect(getByText('View Other Rooms')).toBeTruthy();
      expect(getByText('Modify Search')).toBeTruthy();
    });
  });

  describe('PriceChangeAlert', () => {
    it('renders price change popup per BOOK.md §16', () => {
      const onAccept = jest.fn();
      const onGoBack = jest.fn();
      const { getByText } = render(
        <PriceChangeAlert
          visible={true}
          previousPrice={2500}
          newPrice={2800}
          updatedTotal={5600}
          onAccept={onAccept}
          onGoBack={onGoBack}
        />
      );
      expect(getByText('Room Price Updated')).toBeTruthy();
      expect(getByText('ETB 2,500')).toBeTruthy();
      expect(getByText('ETB 2,800')).toBeTruthy();
      expect(getByText('ETB 5,600')).toBeTruthy();
      expect(getByText('Accept New Price')).toBeTruthy();
      expect(getByText('Go Back')).toBeTruthy();
    });
  });

  describe('RefundStatus & RefundTimeline', () => {
    it('renders refund requested status per BOOK.md §33', () => {
      const { getByText } = render(
        <RefundStatus state="REQUESTED" amount={2500} method="CREDIT_CARD" />
      );
      expect(getByText('Refund requested')).toBeTruthy();
      expect(getByText('Refund amount: ETB 2,500')).toBeTruthy();
      expect(getByText('Original payment: CREDIT CARD')).toBeTruthy();
    });

    it('renders refund processing status per BOOK.md §34', () => {
      const { getByText } = render(
        <RefundStatus state="PROCESSING" amount={2500} method="TELEBIRR" />
      );
      expect(getByText('Refund processing')).toBeTruthy();
      expect(getByText('Your payment provider is processing the refund.')).toBeTruthy();
    });

    it('renders refund completed status per BOOK.md §35', () => {
      const { getByText } = render(
        <RefundStatus state="COMPLETED" amount={2500} method="CBE_BIRR" />
      );
      expect(getByText('Refund completed')).toBeTruthy();
      expect(getByText('The refund was successfully processed.')).toBeTruthy();
    });

    it('renders refund failed status with support CTA per BOOK.md §36', () => {
      const onContactSupport = jest.fn();
      const { getByText } = render(
        <RefundStatus state="FAILED" amount={2500} onContactSupport={onContactSupport} />
      );
      expect(getByText('Refund failed')).toBeTruthy();
      expect(getByText('Contact Support')).toBeTruthy();
    });

    it('renders not applicable status for cash at hotel per BOOK.md §31', () => {
      const { getByText } = render(<RefundStatus state="NOT_APPLICABLE" />);
      expect(getByText('No refund required')).toBeTruthy();
      expect(getByText('No payment was collected, so no refund is required.')).toBeTruthy();
    });

    it('renders no refund status for non-refundable bookings per BOOK.md §32', () => {
      const { getByText } = render(<RefundStatus state="NO_REFUND" />);
      expect(getByText('No refund available')).toBeTruthy();
      expect(getByText('This booking was cancelled outside the refundable period.')).toBeTruthy();
    });

    it('renders refund timeline steps per BOOK.md §37', () => {
      const { getByText } = render(<RefundTimeline state="PROCESSING" />);
      expect(getByText('Cancellation confirmed')).toBeTruthy();
      expect(getByText('Refund requested')).toBeTruthy();
      expect(getByText('Refund processing')).toBeTruthy();
      expect(getByText('Refund completed')).toBeTruthy();
    });
  });

  describe('PriceBreakdown', () => {
    it('renders line items and total per BOOK.md §47', () => {
      const { getByText } = render(
        <PriceBreakdown
          basePrice={1500}
          nights={2}
          taxAmount={450}
          discount={300}
          total={3150}
        />
      );
      expect(getByText('Room (2 nights)')).toBeTruthy();
      expect(getByText('ETB 3,000.00')).toBeTruthy();
      expect(getByText('Tax & fees')).toBeTruthy();
      expect(getByText('ETB 450.00')).toBeTruthy();
      expect(getByText('Discount')).toBeTruthy();
      expect(getByText('−ETB 300.00')).toBeTruthy();
      expect(getByText('Total')).toBeTruthy();
      expect(getByText('ETB 3,150')).toBeTruthy();
    });
  });

  describe('PaymentStatusRow', () => {
    it('renders succeeded paid status per BOOK.md §14', () => {
      const { getByText } = render(
        <PaymentStatusRow method="CREDIT_CARD" status="SUCCEEDED" amount={3000} />
      );
      expect(getByText('Credit Card')).toBeTruthy();
      expect(getByText('Paid')).toBeTruthy();
      expect(getByText('ETB 3,000')).toBeTruthy();
    });

    it('renders pay at hotel status per BOOK.md §13', () => {
      const { getByText } = render(
        <PaymentStatusRow method="CASH_AT_HOTEL" status="PENDING_AT_HOTEL" amount={3000} />
      );
      expect(getByText('Cash At Hotel')).toBeTruthy();
      expect(getByText('Pay at hotel')).toBeTruthy();
    });
  });

  describe('BookingSummary', () => {
    it('renders complete review information per BOOK.md §17', () => {
      const { getByText } = render(
        <BookingSummary
          hotelName="Grand Yaye Hotel"
          roomName="Deluxe Ocean Suite"
          checkIn="2026-09-20"
          checkOut="2026-09-23"
          nights={3}
          adults={2}
          children={1} // eslint-disable-line react/no-children-prop
          leadGuestName="Abebe Bikila"
          leadGuestEmail="abebe@example.com"
          leadGuestPhone="+251911223344"
          subtotal={4500}
          total={4500}
          paymentMethod="TELEBIRR"
        />
      );
      expect(getByText('Grand Yaye Hotel')).toBeTruthy();
      expect(getByText('Deluxe Ocean Suite')).toBeTruthy();
      expect(getByText('Abebe Bikila')).toBeTruthy();
      expect(getByText('abebe@example.com')).toBeTruthy();
      expect(getByText('+251911223344')).toBeTruthy();
      expect(getByText('2 Adults, 1 Child')).toBeTruthy();
      expect(getByText('TELEBIRR')).toBeTruthy();
      expect(getByText('ONLINE PAYMENT')).toBeTruthy();
    });
  });
});

