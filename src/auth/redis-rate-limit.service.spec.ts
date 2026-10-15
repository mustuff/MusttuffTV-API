import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';

const mockClient = {
  isReady: true,
  isOpen: true,
  on: jest.fn(),
  connect: jest.fn(),
  eval: jest.fn(),
  quit: jest.fn(),
};

const mockCreateClient = jest.fn();

jest.unstable_mockModule('redis', () => ({
  createClient: mockCreateClient,
}));

const { RedisRateLimitService } = await import(
  './redis-rate-limit.service'
);

describe('RedisRateLimitService', () => {
  let service: InstanceType<typeof RedisRateLimitService>;
  const originalRedisUrl = process.env.REDIS_URL;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_SECRET = 'test-only-secret';

    mockClient.isReady = true;
    mockClient.isOpen = true;
    mockClient.connect.mockResolvedValue(undefined);
    mockClient.eval.mockResolvedValue(1);
    mockClient.quit.mockResolvedValue(undefined);
    mockCreateClient.mockReturnValue(mockClient);

    service = new RedisRateLimitService();
  });

  afterAll(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('fails closed when REDIS_URL is missing', async () => {
    delete process.env.REDIS_URL;

    await expect(
      service.incrementLoginAttempts('192.0.2.1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('fails closed when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;

    await expect(
      service.incrementLoginAttempts('192.0.2.1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('increments a hashed client key with a 60-second window', async () => {
    mockClient.eval.mockResolvedValue(3);

    await expect(
      service.incrementLoginAttempts('192.0.2.1'),
    ).resolves.toBe(3);

    expect(mockClient.eval).toHaveBeenCalledTimes(1);

    const [script, options] = mockClient.eval.mock.calls[0] as unknown as [
      string,
      { keys: string[]; arguments: string[] },
    ];

    expect(script).toContain('INCR');
    expect(script).toContain('PEXPIRE');
    expect(options.keys[0]).toMatch(
      /^musttufftv:login-rate-limit:[a-f0-9]{64}$/,
    );
    expect(options.keys[0]).not.toContain('192.0.2.1');
    expect(options.arguments).toEqual(['60000']);
  });

  it('returns HTTP 503 if Redis connection fails, then permits a retry', async () => {
    mockClient.connect
      .mockImplementationOnce(async () => {
        mockClient.isReady = false;
        throw new Error('simulated connection failure');
      })
      .mockImplementationOnce(async () => {
        mockClient.isReady = true;
      });

    await expect(
      service.incrementLoginAttempts('192.0.2.2'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    await expect(
      service.incrementLoginAttempts('192.0.2.2'),
    ).resolves.toBe(1);

    expect(mockClient.connect).toHaveBeenCalledTimes(2);
  });
});
