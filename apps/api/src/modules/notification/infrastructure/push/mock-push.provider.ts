import { Injectable, Logger } from '@nestjs/common';
import type { PushMessage, PushNotificationProvider, PushSendResult } from './push.provider';

@Injectable()
export class MockPushProvider implements PushNotificationProvider {
  private readonly logger = new Logger(MockPushProvider.name);

  async send(message: PushMessage): Promise<PushSendResult> {
    if (!message.token) {
      return { success: false, error: 'Push token is required' };
    }
    this.logger.log(
      `[MOCK PUSH] Sent push to token: ${message.token.slice(0, 12)}..., title: "${message.title}"`,
    );
    return {
      success: true,
      messageId: `mock-push-${Date.now()}`,
    };
  }
}
