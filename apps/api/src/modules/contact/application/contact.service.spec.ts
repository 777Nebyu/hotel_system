import { ContactService, ContactActor } from './contact.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('ContactService', () => {
  let service: ContactService;
  let db: any;
  let audit: any;
  let notifications: any;

  const customer: ContactActor = { sub: 'user-1', role: 'CUSTOMER' };
  const manager: ContactActor = { sub: 'mgr-1', role: 'MANAGER' };
  const otherCustomer: ContactActor = { sub: 'user-2', role: 'CUSTOMER' };

  beforeEach(() => {
    db = {
      hotel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'hotel-1',
          name: 'Grand Palace',
          managerId: 'mgr-1',
        }),
      },
      booking: {
        findFirst: jest.fn(),
      },
      contactThread: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      contactMessage: {
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    audit = { record: jest.fn().mockResolvedValue({}) };
    notifications = { notify: jest.fn().mockResolvedValue({}) };

    service = new ContactService(db, audit, notifications);
  });

  describe('createThread', () => {
    it('throws NotFoundException if hotel does not exist', async () => {
      db.hotel.findUnique.mockResolvedValue(null);

      await expect(
        service.createThread(
          'non-existent',
          { subject: 'Check-in inquiry', message: 'Can I check in late?' },
          customer,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if customer references a booking they do not own', async () => {
      db.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        userId: 'other-user',
      });

      await expect(
        service.createThread(
          'hotel-1',
          {
            subject: 'Booking inquiry',
            message: 'Question about my reservation',
            bookingId: 'booking-1',
          },
          customer,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates contact thread and dispatches notification to manager', async () => {
      const mockThread = {
        id: 'thread-1',
        customerId: 'user-1',
        hotelId: 'hotel-1',
        subject: 'Luggage question',
        status: 'OPEN',
        messages: [{ id: 'msg-1', content: 'Can I store bags?' }],
      };
      db.contactThread.create.mockResolvedValue(mockThread);

      const result = await service.createThread(
        'hotel-1',
        { subject: 'Luggage question', message: 'Can I store bags?' },
        customer,
      );

      expect(result.id).toBe('thread-1');
      expect(db.contactThread.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'user-1',
            hotelId: 'hotel-1',
            subject: 'Luggage question',
            status: 'OPEN',
          }),
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'mgr-1',
          type: 'CONTACT_MESSAGE_RECEIVED',
        }),
      );
    });
  });

  describe('getThread', () => {
    it('throws ForbiddenException if customer is not the thread owner', async () => {
      db.contactThread.findUnique.mockResolvedValue({
        id: 'thread-1',
        customerId: 'user-1',
        hotel: { managerId: 'mgr-1' },
      });

      await expect(service.getThread('thread-1', otherCustomer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns thread and marks incoming messages as read', async () => {
      const threadData = {
        id: 'thread-1',
        customerId: 'user-1',
        hotel: { managerId: 'mgr-1' },
        messages: [{ id: 'msg-1', senderId: 'mgr-1', content: 'Sure!' }],
      };
      db.contactThread.findUnique.mockResolvedValue(threadData);

      const result = await service.getThread('thread-1', customer);
      expect(result.id).toBe('thread-1');
      expect(db.contactMessage.updateMany).toHaveBeenCalledWith({
        where: {
          threadId: 'thread-1',
          senderId: { not: 'user-1' },
          readAt: null,
        },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('sendMessage', () => {
    it('appends message and notifies recipient', async () => {
      db.contactThread.findUnique.mockResolvedValue({
        id: 'thread-1',
        customerId: 'user-1',
        hotel: { id: 'hotel-1', name: 'Grand Palace', managerId: 'mgr-1' },
      });
      db.contactMessage.create.mockResolvedValue({
        id: 'msg-2',
        content: 'Thank you!',
      });
      db.contactThread.update.mockResolvedValue({});

      const msg = await service.sendMessage(
        'thread-1',
        { content: 'Thank you!' },
        customer,
      );

      expect(msg.id).toBe('msg-2');
      expect(db.contactThread.update).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { status: 'OPEN', updatedAt: expect.any(Date) },
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'mgr-1',
          type: 'CONTACT_MESSAGE_RECEIVED',
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('updates thread status', async () => {
      db.contactThread.findUnique.mockResolvedValue({
        id: 'thread-1',
        customerId: 'user-1',
        hotel: { managerId: 'mgr-1' },
      });
      db.contactThread.update.mockResolvedValue({
        id: 'thread-1',
        status: 'CLOSED',
      });

      const updated = await service.updateStatus(
        'thread-1',
        { status: 'CLOSED' },
        manager,
      );

      expect(updated.status).toBe('CLOSED');
      expect(db.contactThread.update).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { status: 'CLOSED' },
      });
    });
  });
});
