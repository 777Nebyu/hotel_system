import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PushMessage, PushNotificationProvider, PushSendResult } from './push.provider';

@Injectable()
export class ExpoPushProvider implements PushNotificationProvider {
  private readonly logger = new Logger(ExpoPushProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(message: PushMessage): Promise<PushSendResult> {
    if (!message.token) {
      return { success: false, error: 'Push token is required' };
    }

    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: message.token,
          title: message.title,
          body: message.body,
          data: message.data,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Expo push API returned error ${response.status}: ${errorText}`);
        return { success: false, error: `Expo API error: ${response.status}` };
      }

      const data = (await response.json()) as {
        data?: Array<{ status: string; id?: string; message?: string; details?: { error?: string } }>;
        errors?: Array<{ message: string }>;
      };

      if (data.errors && data.errors.length > 0) {
        return { success: false, error: data.errors[0].message };
      }

      const ticket = data.data?.[0];
      if (ticket?.status === 'error') {
        return {
          success: false,
          error: ticket.message || ticket.details?.error || 'Failed to deliver push ticket',
        };
      }

      return {
        success: true,
        messageId: ticket?.id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown push delivery failure';
      this.logger.error(`Failed to send push notification: ${msg}`);
      return { success: false, error: msg };
    }
  }
}
