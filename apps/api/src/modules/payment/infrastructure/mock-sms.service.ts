import { Injectable, Logger } from '@nestjs/common';

export interface MockSmsMessage {
  id: string;
  to: string;
  body: string;
  createdAt: Date;
}

@Injectable()
export class MockSmsService {
  private readonly logger = new Logger(MockSmsService.name);
  private messages: MockSmsMessage[] = [];
  private idCounter = 0;

  /**
   * Store an SMS message in memory (development only).
   */
  send(to: string, body: string): MockSmsMessage {
    const message: MockSmsMessage = {
      id: `sms_${Date.now().toString(36)}_${++this.idCounter}`,
      to,
      body,
      createdAt: new Date(),
    };
    this.messages.unshift(message);

    // Keep only last 100 messages
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(0, 100);
    }

    this.logger.log({
      message: 'Mock SMS sent',
      to,
      messageId: message.id,
    });

    return message;
  }

  /**
   * Get all messages.
   */
  getAll(): MockSmsMessage[] {
    return [...this.messages];
  }

  /**
   * Get messages by phone number.
   */
  getByPhone(phone: string): MockSmsMessage[] {
    const normalized = phone.replace(/[\s-]/g, '');
    return this.messages.filter(
      (m) => m.to.replace(/[\s-]/g, '') === normalized,
    );
  }

  /**
   * Get a specific message by ID.
   */
  getById(id: string): MockSmsMessage | undefined {
    return this.messages.find((m) => m.id === id);
  }

  /**
   * Clear all messages.
   */
  clear(): void {
    const count = this.messages.length;
    this.messages = [];
    this.logger.log({
      message: 'Mock SMS inbox cleared',
      count,
    });
  }

  /**
   * Delete a specific message.
   */
  delete(id: string): boolean {
    const index = this.messages.findIndex((m) => m.id === id);
    if (index === -1) return false;
    this.messages.splice(index, 1);
    return true;
  }

  /**
   * Get message count.
   */
  count(): number {
    return this.messages.length;
  }
}
