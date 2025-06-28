import { createHash } from 'crypto';
import { LLMRequest, LLMResponse } from '@/gateway/types';

export interface CacheService {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

// In-memory cache for development
class InMemoryCache implements CacheService {
  private cache = new Map<string, { value: any; expires: number }>();

  async get(key: string): Promise<any | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }
}

// Redis cache for production
class RedisCache implements CacheService {
  private redisUrl: string;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  async get(key: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.redisUrl}/get/${key}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await fetch(`${this.redisUrl}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, ttl })
      });
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fetch(`${this.redisUrl}/delete/${key}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }
}

// LLM-specific cache wrapper
export class LLMCache {
  private cache: CacheService;
  private enabled: boolean;
  private ttl: number;

  constructor(
    cache?: CacheService,
    enabled: boolean = true,
    ttl: number = 3600 // 1 hour default
  ) {
    this.cache = cache || this.createCache();
    this.enabled = enabled;
    this.ttl = ttl;
  }

  private createCache(): CacheService {
    if (process.env.REDIS_URL) {
      return new RedisCache(process.env.REDIS_URL);
    }
    return new InMemoryCache();
  }

  generateCacheKey(request: LLMRequest, clientId: string): string {
    const normalized = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 1000,
      clientId
    };
    
    const hash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
    
    return `llm:${clientId}:${hash}`;
  }

  async get(request: LLMRequest, clientId: string): Promise<LLMResponse | null> {
    if (!this.enabled) return null;
    
    const key = this.generateCacheKey(request, clientId);
    const cached = await this.cache.get(key);
    
    if (cached) {
      console.log(`Cache hit for request: ${key}`);
      return cached as LLMResponse;
    }
    
    return null;
  }

  async set(
    request: LLMRequest,
    response: LLMResponse,
    clientId: string,
    ttl?: number
  ): Promise<void> {
    if (!this.enabled) return;
    
    const key = this.generateCacheKey(request, clientId);
    await this.cache.set(key, response, ttl || this.ttl);
    console.log(`Cached response: ${key}`);
  }

  async invalidate(clientId: string): Promise<void> {
    // In production, this would invalidate all keys for a client
    console.log(`Invalidating cache for client: ${clientId}`);
  }
}

// Request deduplication to prevent duplicate concurrent requests
export class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already in progress
    const existing = this.pending.get(key);
    if (existing) {
      console.log(`Deduplicating request: ${key}`);
      return existing;
    }

    // Create new promise and store it
    const promise = fn().finally(() => {
      // Clean up after completion
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

// Circuit breaker for resilience
export class CircuitBreaker {
  private failures = new Map<string, number>();
  private lastFailure = new Map<string, number>();
  private state = new Map<string, 'closed' | 'open' | 'half-open'>();
  
  private threshold: number;
  private timeout: number;
  private resetTimeout: number;

  constructor(
    threshold: number = 5,
    timeout: number = 60000, // 1 minute
    resetTimeout: number = 30000 // 30 seconds
  ) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const currentState = this.state.get(key) || 'closed';
    
    if (currentState === 'open') {
      const lastFailureTime = this.lastFailure.get(key) || 0;
      if (Date.now() - lastFailureTime > this.resetTimeout) {
        this.state.set(key, 'half-open');
      } else {
        throw new Error(`Circuit breaker is open for ${key}`);
      }
    }

    try {
      const result = await fn();
      
      // Reset on success
      if (currentState === 'half-open') {
        this.state.set(key, 'closed');
        this.failures.delete(key);
      }
      
      return result;
    } catch (error) {
      const failures = (this.failures.get(key) || 0) + 1;
      this.failures.set(key, failures);
      this.lastFailure.set(key, Date.now());
      
      if (failures >= this.threshold) {
        this.state.set(key, 'open');
        console.error(`Circuit breaker opened for ${key} after ${failures} failures`);
      }
      
      throw error;
    }
  }

  getState(key: string): 'closed' | 'open' | 'half-open' {
    return this.state.get(key) || 'closed';
  }

  reset(key: string): void {
    this.state.set(key, 'closed');
    this.failures.delete(key);
    this.lastFailure.delete(key);
  }
}

// Export singleton instances
export const llmCache = new LLMCache();
export const requestDeduplicator = new RequestDeduplicator();
export const circuitBreaker = new CircuitBreaker();