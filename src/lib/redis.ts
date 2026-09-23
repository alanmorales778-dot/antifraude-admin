interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class FastRedisCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private rateLimits: Map<string, { count: number; resetAt: number }> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Obtener valor cacheado (simula Redis GET <1ms)
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Guardar valor en caché con TTL en segundos (simula Redis SETEX)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalidar clave (simula Redis DEL)
   */
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Control de velocidad (Rate Limiting con ventana de tiempo)
   */
  async checkRateLimit(apiKey: string, limit: number = 1000, windowSeconds: number = 60): Promise<{
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
  }> {
    const now = Date.now();
    const entry = this.rateLimits.get(apiKey);

    if (!entry || now > entry.resetAt) {
      this.rateLimits.set(apiKey, { count: 1, resetAt: now + windowSeconds * 1000 });
      return { allowed: true, remaining: limit - 1, resetInSeconds: windowSeconds };
    }

    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  getStats() {
    return {
      totalKeys: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1) + '%' : '100%',
    };
  }

  clear() {
    this.cache.clear();
    this.rateLimits.clear();
  }
}

// Singleton global para persistir estado durante la ejecución del servidor
const globalForRedis = global as unknown as { fastRedis: FastRedisCache };
export const redis = globalForRedis.fastRedis || new FastRedisCache();
if (process.env.NODE_ENV !== 'production') globalForRedis.fastRedis = redis;
