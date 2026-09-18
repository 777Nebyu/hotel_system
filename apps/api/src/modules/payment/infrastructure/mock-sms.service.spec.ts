import { MockSmsService } from './mock-sms.service';

describe('MockSmsService', () => {
  let service: MockSmsService;

  beforeEach(() => {
    service = new MockSmsService();
  });

  describe('send', () => {
    it('should store an SMS message', () => {
      const msg = service.send('+251911111111', 'Test message');
      expect(msg).toBeTruthy();
      expect(msg.to).toBe('+251911111111');
      expect(msg.body).toBe('Test message');
      expect(msg.id).toBeTruthy();
      expect(msg.createdAt).toBeInstanceOf(Date);
    });

    it('should prepend messages (newest first)', () => {
      service.send('+251911111111', 'First');
      service.send('+251911111111', 'Second');
      const all = service.getAll();
      expect(all[0].body).toBe('Second');
      expect(all[1].body).toBe('First');
    });

    it('should keep only last 100 messages', () => {
      for (let i = 0; i < 110; i++) {
        service.send('+251911111111', `Message ${i}`);
      }
      expect(service.count()).toBe(100);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no messages', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('should return all messages', () => {
      service.send('+251911111111', 'Msg 1');
      service.send('+251911111111', 'Msg 2');
      expect(service.getAll().length).toBe(2);
    });
  });

  describe('getByPhone', () => {
    it('should filter by phone number', () => {
      service.send('+251911111111', 'Msg 1');
      service.send('+251922222222', 'Msg 2');
      service.send('+251911111111', 'Msg 3');

      const result = service.getByPhone('+251911111111');
      expect(result.length).toBe(2);
    });

    it('should handle phone numbers with spaces/dashes', () => {
      service.send('+251911111111', 'Msg 1');
      const result = service.getByPhone('+251 911 111 111');
      expect(result.length).toBe(1);
    });
  });

  describe('getById', () => {
    it('should return message by ID', () => {
      const msg = service.send('+251911111111', 'Test');
      const found = service.getById(msg.id);
      expect(found).toBeTruthy();
      expect(found!.body).toBe('Test');
    });

    it('should return undefined for non-existent ID', () => {
      expect(service.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all messages', () => {
      service.send('+251911111111', 'Msg 1');
      service.send('+251911111111', 'Msg 2');
      service.clear();
      expect(service.count()).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete a specific message', () => {
      const msg = service.send('+251911111111', 'Test');
      const deleted = service.delete(msg.id);
      expect(deleted).toBe(true);
      expect(service.count()).toBe(0);
    });

    it('should return false for non-existent ID', () => {
      expect(service.delete('nonexistent')).toBe(false);
    });
  });

  describe('count', () => {
    it('should return correct count', () => {
      expect(service.count()).toBe(0);
      service.send('+251911111111', 'Msg 1');
      expect(service.count()).toBe(1);
      service.send('+251911111111', 'Msg 2');
      expect(service.count()).toBe(2);
    });
  });
});
