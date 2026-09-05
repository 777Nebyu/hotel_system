export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PushNotificationProvider {
  send(message: PushMessage): Promise<PushSendResult>;
}

export const PUSH_NOTIFICATION_PROVIDER = 'PUSH_NOTIFICATION_PROVIDER';
