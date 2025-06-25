export class SensitiveKeyCache {
  private static cache = new Map<string, boolean>();
  private static cacheSize = 1000;

  public static isSensitive(key: string, sensitiveKeys: string[]): boolean {
    const cacheKey = this.createCacheKey(key, sensitiveKeys);

    // Check cache
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    // Check if key is sensitive
    const result = this.checkKeySensitivity(key, sensitiveKeys);

    // Store result in cache
    this.setCachedResult(cacheKey, result);

    return result;
  }

  static clearCache(): void {
    this.cache.clear();
  }

  private static createCacheKey(key: string, sensitiveKeys: string[]): string {
    const sortedKeys = [...sensitiveKeys].sort().join('|');
    return `${key.toLowerCase()}_${sortedKeys}`;
  }

  private static getCachedResult(cacheKey: string): boolean | undefined {
    if (this.cache.has(cacheKey)) {
      const result = this.cache.get(cacheKey)!;
      // Move to end for LRU behavior
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, result);
      return result;
    }
    return undefined;
  }

  private static checkKeySensitivity(key: string, sensitiveKeys: string[]): boolean {
    return sensitiveKeys.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey.toLowerCase()),
    );
  }

  private static setCachedResult(cacheKey: string, result: boolean): void {
    this.evictOldestIfNeeded();
    this.cache.set(cacheKey, result);
  }

  private static evictOldestIfNeeded(): void {
    if (this.cache.size >= this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }
}
