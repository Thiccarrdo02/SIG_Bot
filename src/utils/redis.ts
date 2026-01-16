import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redis: Redis | null = null;
let useMemoryFallback = false;

export function getRedis(): Redis | null {
  // If Redis URL is not configured or is empty, use memory fallback
  if (!config.redis.url || config.redis.url === 'redis://localhost:6379' && process.env.NODE_ENV === 'development') {
    useMemoryFallback = true;
    return null;
  }

  if (!redis) {
    try {
      redis = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) {
            useMemoryFallback = true;
            return null; // Stop retrying
          }
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      redis.on('connect', () => {
        logger.info('Redis connected');
        useMemoryFallback = false;
      });

      redis.on('error', (err) => {
        if (!useMemoryFallback) {
          logger.warn('Redis unavailable, using memory fallback');
          useMemoryFallback = true;
        }
      });
    } catch (error) {
      logger.warn('Redis initialization failed, using memory fallback');
      useMemoryFallback = true;
      return null;
    }
  }
  return redis;
}

// In-memory store for local testing
const memoryStore = new Map<string, { value: string; expiry: number }>();

export const cache = {
  async get(key: string): Promise<string | null> {
    // Always try memory first in fallback mode
    if (useMemoryFallback) {
      const item = memoryStore.get(key);
      if (item && item.expiry > Date.now()) {
        return item.value;
      }
      memoryStore.delete(key);
      return null;
    }

    try {
      const redisClient = getRedis();
      if (!redisClient) {
        useMemoryFallback = true;
        return this.get(key); // Retry with memory
      }
      return await redisClient.get(key);
    } catch (error) {
      useMemoryFallback = true;
      const item = memoryStore.get(key);
      if (item && item.expiry > Date.now()) {
        return item.value;
      }
      memoryStore.delete(key);
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    // Store in memory (always, as backup)
    memoryStore.set(key, {
      value,
      expiry: Date.now() + (ttlSeconds || 86400) * 1000,
    });

    if (useMemoryFallback) return;

    try {
      const redisClient = getRedis();
      if (!redisClient) return;

      if (ttlSeconds) {
        await redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      useMemoryFallback = true;
    }
  },

  async del(key: string): Promise<void> {
    memoryStore.delete(key);

    if (useMemoryFallback) return;

    try {
      const redisClient = getRedis();
      if (redisClient) {
        await redisClient.del(key);
      }
    } catch (error) {
      useMemoryFallback = true;
    }
  },

  async exists(key: string): Promise<boolean> {
    if (useMemoryFallback) {
      const item = memoryStore.get(key);
      return !!(item && item.expiry > Date.now());
    }

    try {
      const redisClient = getRedis();
      if (!redisClient) {
        useMemoryFallback = true;
        return this.exists(key);
      }
      return (await redisClient.exists(key)) === 1;
    } catch (error) {
      useMemoryFallback = true;
      return memoryStore.has(key);
    }
  },

  async scan(pattern: string): Promise<string[]> {
    if (useMemoryFallback) {
      const searchTerm = pattern.replace('*', '');
      return Array.from(memoryStore.keys()).filter(k => k.includes(searchTerm));
    }

    try {
      const redisClient = getRedis();
      if (!redisClient) {
        useMemoryFallback = true;
        return this.scan(pattern);
      }

      const keys: string[] = [];
      let cursor = '0';

      do {
        const [newCursor, foundKeys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        keys.push(...foundKeys);
      } while (cursor !== '0');

      return keys;
    } catch (error) {
      useMemoryFallback = true;
      const searchTerm = pattern.replace('*', '');
      return Array.from(memoryStore.keys()).filter(k => k.includes(searchTerm));
    }
  },

  isUsingMemory(): boolean {
    return useMemoryFallback;
  }
};

export default cache;
