import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(CacheService.name);

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('REDIS_URL');
    const isTls = url.startsWith('rediss://') || url.includes('upstash.io');
    this.client = new Redis(url, {
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn(`Cache get failed for key "${key}": ${err}`);
      return null; // degrade gracefully
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Cache set failed for key "${key}": ${err}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Cache del failed for key "${key}": ${err}`);
    }
  }

  onModuleDestroy() {
    void this.client.quit();
  }
}
