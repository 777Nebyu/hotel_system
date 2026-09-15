import { NoShowProcessor } from './noshow.processor';
import { NOSHOW_DETECTION_JOB } from './noshow.scheduler';

describe('NoShowProcessor', () => {
  let processor: NoShowProcessor;
  let db: any;
  let mail: any;
  let audit: any;
  let emitter: any;

  beforeEach(() => {
    db = {
      booking: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      roomAvailability: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bookingStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    mail = {
      enqueue: jest.fn().mockResolvedValue({}),
    };
    audit = {
      record: jest.fn().mockResolvedValue({}),
    };
    emitter = {
      emit: jest.fn(),
    };
    processor = new NoShowProcessor(db, mail, audit, emitter);
  });

  it('ignores jobs that do not match NOSHOW_DETECTION_JOB', async () => {
    await processor.process({ name: 'other-job' } as any);
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when no confirmed bookings have passed check-in date', async () => {
    db.booking.findMany.mockResolvedValue([]);
    await processor.process({ name: NOSHOW_DETECTION_JOB } as any);
    expect(db.booking.findMany).toHaveBeenCalled();
    expect(db.booking.update).not.toHaveBeenCalled();
    expect(mail.enqueue).not.toHaveBeenCalled();
  });

  it('processes overdue bookings, releases room availability, records history & audit, and sends email', async () => {
    const mockCheckIn = new Date(Date.now() - 24 * 3600 * 1000);
    const mockCheckOut = new Date(Date.now() + 48 * 3600 * 1000);

    db.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        checkIn: mockCheckIn,
        checkOut: mockCheckOut,
        user: {
          id: 'user-1',
          email: 'guest@example.com',
          fullName: 'Alice Guest',
        },
        hotel: {
          id: 'hotel-1',
          name: 'Grand Hyatt',
        },
        details: [{ roomId: 'room-1' }, { roomId: 'room-2' }],
      },
    ]);

    await processor.process({ name: NOSHOW_DETECTION_JOB } as any);

    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'NO_SHOW' },
    });

    expect(db.roomAvailability.deleteMany).toHaveBeenCalledWith({
      where: {
        roomId: { in: ['room-1', 'room-2'] },
        date: { gte: mockCheckIn, lt: mockCheckOut },
        status: 'UNAVAILABLE',
      },
    });

    expect(db.bookingStatusHistory.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'booking-1',
        status: 'NO_SHOW',
        changedBy: 'system',
        reason: 'Check-in date passed without guest arrival',
      },
    });

    expect(audit.record).toHaveBeenCalledWith(
      'system',
      'BOOKING_NO_SHOW',
      'Booking',
      'booking-1',
      { reason: 'Check-in date passed without guest arrival' },
    );

    expect(mail.enqueue).toHaveBeenCalledWith({
      to: 'guest@example.com',
      subject: 'Booking Marked as No-Show',
      html: expect.stringContaining('Grand Hyatt'),
    });
  });
});
