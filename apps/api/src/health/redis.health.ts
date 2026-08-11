import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async ping(key: string): Promise<HealthIndicatorResult> {
    const url = this.config.getOrThrow<string>('redis.url');
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    try {
      await client.connect();
      const reply = await client.ping();
      const isHealthy = reply === 'PONG';
      return this.getStatus(key, isHealthy);
    } catch (error) {
      const result = this.getStatus(key, false, {
        message: error instanceof Error ? error.message : 'redis ping failed',
      });
      throw new HealthCheckError('Redis check failed', result);
    } finally {
      client.disconnect();
    }
  }
}
