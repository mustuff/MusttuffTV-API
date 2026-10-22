import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { createClient, RedisClientType } from 'redis';

const WINDOW_MS = 60_000;
const KEY_PREFIX = 'musttufftv:login-rate-limit:';

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class RedisRateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimitService.name);
  private client?: RedisClientType;
  private connectPromise?: Promise<void>;

  async incrementLoginAttempts(clientIp: string): Promise<number> {
    const redisUrl = process.env.REDIS_URL;
    const hashSecret = process.env.JWT_SECRET;

    if (!redisUrl || !hashSecret) {
      throw new ServiceUnavailableException(
        'Login protection is temporarily unavailable.',
      );
    }

    try {
      const client = await this.getClient(redisUrl);
      const ipHash = createHmac('sha256', hashSecret)
        .update(clientIp)
        .digest('hex');

      const result = await client.eval(INCREMENT_SCRIPT, {
        keys: [`${KEY_PREFIX}${ipHash}`],
        arguments: [String(WINDOW_MS)],
      });

      const count = Number(result);

      if (!Number.isSafeInteger(count) || count < 1) {
        throw new Error('Unexpected Redis rate-limit result');
      }

      return count;
    } catch (error: unknown) {
      const errorName =
        error instanceof Error ? error.name : typeof error;

      this.logger.error(
        `Login rate-limit operation failed (${errorName}).`,
      );

      throw new ServiceUnavailableException(
        'Login protection is temporarily unavailable.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit().catch(() => undefined);
    }
  }

  private async getClient(redisUrl: string): Promise<RedisClientType> {
    if (this.client?.isReady) {
      return this.client;
    }

    if (!this.client) {
      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 3_000,
          reconnectStrategy: false,
        },
      });

      this.client.on('error', () => undefined);
    }

    if (!this.connectPromise) {
      this.connectPromise = this.client.connect().then(() => undefined);
    }

    try {
      await this.connectPromise;
    } catch {
      this.connectPromise = undefined;
      throw new Error('Redis connection failed');
    }

    if (!this.client.isReady) {
      throw new Error('Redis is not ready');
    }

    return this.client;
  }
}
