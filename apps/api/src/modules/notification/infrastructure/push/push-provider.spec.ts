import { ConfigService } from '@nestjs/config';
import { ExpoPushProvider } from './expo-push.provider';
import { MockPushProvider } from './mock-push.provider';

describe('Push Providers', () => {
  describe('MockPushProvider', () => {
    it('returns success for valid push message', async () => {
      const provider = new MockPushProvider();
      const res = await provider.send({
        token: 'test-token',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toContain('mock-push-');
    });

    it('returns error when token is missing', async () => {
      const provider = new MockPushProvider();
      const res = await provider.send({
        token: '',
        title: 'Title',
        body: 'Body',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Push token is required');
    });
  });

  describe('ExpoPushProvider', () => {
    let provider: ExpoPushProvider;
    let config: { get: jest.Mock };

    beforeEach(() => {
      config = { get: jest.fn().mockReturnValue('mock-expo-token') };
      provider = new ExpoPushProvider(config as unknown as ConfigService);
      global.fetch = jest.fn();
    });

    it('successfully sends push via Expo API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ status: 'ok', id: 'expo-ticket-1' }],
        }),
      });

      const res = await provider.send({
        token: 'ExponentPushToken[abc]',
        title: 'Hello',
        body: 'World',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('expo-ticket-1');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-expo-token',
          }),
        }),
      );
    });

    it('handles Expo ticket error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [
            {
              status: 'error',
              message: 'DeviceNotRegistered',
            },
          ],
        }),
      });

      const res = await provider.send({
        token: 'ExponentPushToken[invalid]',
        title: 'Hello',
        body: 'World',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('DeviceNotRegistered');
    });

    it('handles network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network offline'));

      const res = await provider.send({
        token: 'ExponentPushToken[abc]',
        title: 'Hello',
        body: 'World',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Network offline');
    });
  });
});
