import { NotificationService } from './notification.service';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from '../domain';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { PushNotificationProvider } from '../infrastructure/push';

describe('NotificationService', () => {
  let service: NotificationService;
  let db: {
    notificationPreference: { findUnique: jest.Mock };
    notification: {
      findFirst: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let pushProvider: { send: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    db = {
      notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({ id: 'notif-1', ...args.data }),
        ),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };

    pushProvider = {
      send: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-123' }),
    };

    service = new NotificationService(
      db as unknown as PrismaService,
      pushProvider as unknown as PushNotificationProvider,
    );
  });

  it('suppresses notification if user disabled it in preferences', async () => {
    db.notificationPreference.findUnique.mockResolvedValue({
      userId: 'user-1',
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMATION,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      enabled: false,
    });

    const res = await service.notify({
      userId: 'user-1',
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMATION,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      payload: { bookingId: 'b-1' },
    });

    expect(res).toBeNull();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('deduplicates identical notification sent within 5 minutes', async () => {
    const existing = {
      id: 'existing-1',
      userId: 'user-1',
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMATION,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      payload: { bookingId: 'b-1' },
    };
    db.notification.findFirst.mockResolvedValue(existing);

    const res = await service.notify({
      userId: 'user-1',
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMATION,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      payload: { bookingId: 'b-1' },
    });

    expect(res).toEqual(existing);
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('delivers push notification via PushNotificationProvider when user has push token', async () => {
    db.user.findUnique.mockResolvedValue({
      id: 'user-1',
      pushToken: 'ExponentPushToken[xxxx]',
    });

    const res = await service.notify({
      userId: 'user-1',
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMATION,
      channel: NOTIFICATION_CHANNELS.PUSH,
      payload: { title: 'Booking Confirmed!', message: 'Your room is ready' },
    });

    expect(pushProvider.send).toHaveBeenCalledWith({
      token: 'ExponentPushToken[xxxx]',
      title: 'Booking Confirmed!',
      body: 'Your room is ready',
      data: { title: 'Booking Confirmed!', message: 'Your room is ready' },
    });
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          channel: NOTIFICATION_CHANNELS.PUSH,
          sentAt: expect.any(Date),
        }),
      }),
    );
    expect(res?.sentAt).toBeDefined();
  });

  it('handles push delivery failure gracefully without setting sentAt', async () => {
    db.user.findUnique.mockResolvedValue({
      id: 'user-1',
      pushToken: 'ExponentPushToken[invalid]',
    });
    pushProvider.send.mockResolvedValue({
      success: false,
      error: 'DeviceNotRegistered',
    });

    const res = await service.notify({
      userId: 'user-1',
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMATION,
      channel: NOTIFICATION_CHANNELS.PUSH,
      payload: { title: 'Hello', message: 'World' },
    });

    expect(pushProvider.send).toHaveBeenCalled();
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          sentAt: null,
        }),
      }),
    );
  });
});
