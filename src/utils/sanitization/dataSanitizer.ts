import {
  SanitizationReport,
  SanitizationParams,
} from '../../config/coreTypes/configTypes/sanitization.types';
import { SensitiveKeyCache } from './sensitiveKeyCache';
import { MaskValue, NeverTruncateDefaultKeys } from './sanitization.constants.ts';
import { defaultSensitiveKeys, defaultSensitivePatterns } from './sensitive-keys.config';
import ErrorHandler from '../errors/errorHandler';
import logger from '../logging/loggerManager';

export default class DataSanitizer {
  private static defaultSanitizationParams: SanitizationParams = {
    sensitiveKeys: defaultSensitiveKeys,
    maskValue: MaskValue,
    truncateUrls: false,
    maxStringLength: 1000,
    neverTruncateKeys: NeverTruncateDefaultKeys,
    enablePatternDetection: true,
    customPatterns: [],
    reportingEnabled: false,
    maxDepth: 10,
    chunkSize: 1000,
  };

  /**
   * Updates the default sanitization parameters
   */
  public static updateDefaultParams(params: Partial<SanitizationParams>): void {
    if (!params || typeof params !== 'object') {
      logger.warn('Invalid sanitization parameters provided, skipping update');
      return;
    }

    this.defaultSanitizationParams = { ...this.defaultSanitizationParams, ...params };
    logger.debug('Sanitization parameters updated successfully');
  }

  /**
   * Get current default sanitization parameters
   */
  public static getDefaultParams(): SanitizationParams {
    return { ...this.defaultSanitizationParams };
  }

  /**
   * Main sanitization method with enhanced pattern detection
   */
  public static sanitizeData<T>(
    data: T,
    config: SanitizationParams = this.defaultSanitizationParams,
  ): T {
    const report: SanitizationReport = {
      keysProcessed: 0,
      keysSanitized: 0,
      sanitizedKeys: [],
      patternsFound: [],
      circularReferences: 0,
    };

    return this.sanitizeDataWithContext(data, config, report);
  }

  /**
   * Core sanitization logic with context tracking
   */
  private static sanitizeDataWithContext<T>(
    data: T,
    config: SanitizationParams,
    report: SanitizationReport,
    depth: number = 0,
    seen: WeakSet<object> = new WeakSet(),
    path: string = '',
  ): T {
    // Prevent infinite recursion
    if (depth > (config.maxDepth || 10)) {
      logger.warn(`Maximum depth reached at path: ${path}`);
      return data;
    }

    // Handle primitives
    if (data === null || data === undefined || typeof data !== 'object') {
      return this.handlePrimitiveValue(data, config, report, path);
    }

    // Handle circular references
    if (seen.has(data as object)) {
      report.circularReferences++;
      return '[Circular Reference]' as unknown as T;
    }
    seen.add(data as object);

    // Handle arrays
    if (Array.isArray(data)) {
      const sanitizedArray: unknown[] = [];
      for (let index = 0; index < data.length; index++) {
        const item = data[index];
        const itemPath = `${path}[${index}]`;
        const sanitizedItem = this.sanitizeDataWithContext(
          item,
          config,
          report,
          depth + 1,
          seen,
          itemPath,
        );
        sanitizedArray.push(sanitizedItem);
      }
      return sanitizedArray as T;
    }

    // Handle objects
    return this.sanitizeObject(data, config, report, depth, seen, path);
  }

  /**
   * Memory-efficient sanitization for large datasets
   */
  public static async sanitizeLargeData<T>(
    data: T,
    config: SanitizationParams = this.defaultSanitizationParams,
  ): Promise<T> {
    if (!Array.isArray(data)) {
      return this.sanitizeData(data, config);
    }

    const result: unknown[] = [];
    const chunkSize = config.chunkSize || 1000;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      // Process chunk items individually
      const sanitizedChunk: unknown[] = [];
      for (const item of chunk) {
        const sanitizedItem = this.sanitizeData(item, config);
        sanitizedChunk.push(sanitizedItem);
      }

      result.push(...sanitizedChunk);

      // Yield control for large datasets
      if (i % (chunkSize * 10) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return result as T;
  }

  /**
   * Sanitization with detailed reporting
   */
  public static sanitizeWithReport<T>(
    data: T,
    config: SanitizationParams = this.defaultSanitizationParams,
  ): { sanitized: T; report: SanitizationReport } {
    const report: SanitizationReport = {
      keysProcessed: 0,
      keysSanitized: 0,
      sanitizedKeys: [],
      patternsFound: [],
      circularReferences: 0,
    };

    const enhancedConfig = { ...config, reportingEnabled: true };
    const sanitized = this.sanitizeDataWithContext(data, enhancedConfig, report);
    return { sanitized, report };
  }

  /**
   * Pattern detection for sensitive data
   */
  private static containsSensitivePatterns(
    value: string,
    config: SanitizationParams,
    report?: SanitizationReport,
  ): { hasSensitive: boolean; patterns: string[] } {
    if (typeof value !== 'string' || !config.enablePatternDetection) {
      return { hasSensitive: false, patterns: [] };
    }

    const patterns = [...defaultSensitivePatterns, ...(config.customPatterns || [])];
    const foundPatterns: string[] = [];

    for (const pattern of patterns) {
      if (pattern.test(value)) {
        foundPatterns.push(pattern.source);
        if (report) {
          report.patternsFound.push(pattern.source);
        }
      }
    }

    return { hasSensitive: foundPatterns.length > 0, patterns: foundPatterns };
  }

  /**
   * Handle primitive values with pattern detection
   */
  private static handlePrimitiveValue<T>(
    data: T,
    config: SanitizationParams,
    report: SanitizationReport,
    path: string,
  ): T {
    report.keysProcessed++;

    if (typeof data === 'string') {
      const { hasSensitive, patterns } = this.containsSensitivePatterns(data, config, report);

      if (hasSensitive) {
        report.keysSanitized++;
        report.sanitizedKeys.push(`${path} (pattern: ${patterns.join(', ')})`);
        return (config.maskValue || MaskValue) as unknown as T;
      }

      // Handle string truncation
      if (config.maxStringLength && data.length > config.maxStringLength) {
        return this.truncateString(data, config.maxStringLength) as unknown as T;
      }
    }

    return data;
  }

  /**
   * Sanitize object properties
   */
  private static sanitizeObject<T>(
    data: T,
    config: SanitizationParams,
    report: SanitizationReport,
    depth: number,
    seen: WeakSet<object>,
    path: string,
  ): T {
    const sanitizedObject = { ...(data as object) } as Record<string, unknown>;
    const sensitiveKeysSet = new Set(config.sensitiveKeys.map((key) => key.toLowerCase()));

    Object.keys(sanitizedObject).forEach((key) => {
      const value = sanitizedObject[key];
      const keyPath = path ? `${path}.${key}` : key;
      report.keysProcessed++;

      const keyLower = key.toLowerCase();
      const isSensitiveKey =
        sensitiveKeysSet.has(keyLower) || SensitiveKeyCache.isSensitive(key, config.sensitiveKeys);

      if (isSensitiveKey) {
        sanitizedObject[key] = config.maskValue;
        report.keysSanitized++;
        report.sanitizedKeys.push(keyPath);
      } else if (typeof value === 'string') {
        sanitizedObject[key] = this.processStringValue(value, key, config, report, keyPath);
      } else if (typeof value === 'object' && value !== null) {
        sanitizedObject[key] = this.sanitizeDataWithContext(
          value,
          config,
          report,
          depth + 1,
          seen,
          keyPath,
        );
      }
    });

    return sanitizedObject as T;
  }

  /**
   * Process string values with pattern detection and truncation
   */
  private static processStringValue(
    value: string,
    key: string,
    config: SanitizationParams,
    report: SanitizationReport,
    path: string,
  ): string {
    // Check for sensitive patterns
    if (config.enablePatternDetection) {
      const { hasSensitive, patterns } = this.containsSensitivePatterns(value, config, report);
      if (hasSensitive) {
        report.keysSanitized++;
        report.sanitizedKeys.push(`${path} (pattern: ${patterns.join(', ')})`);
        return config.maskValue || MaskValue;
      }
    }

    // Skip truncation for specified keys
    if (this.shouldNeverTruncate(key, config.neverTruncateKeys)) {
      return value;
    }

    // Apply truncation if needed
    if (config.maxStringLength && value.length > config.maxStringLength) {
      return this.truncateString(value, config.maxStringLength);
    }

    return value;
  }

  /**
   * Simplified string truncation
   */
  private static truncateString(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  }

  /**
   * Check if key should never be truncated
   */
  private static shouldNeverTruncate(key: string, neverTruncateKeys?: string[]): boolean {
    if (!neverTruncateKeys) return false;
    return neverTruncateKeys.some((neverKey) => neverKey.toLowerCase() === key.toLowerCase());
  }

  /**
   * Clear performance caches
   */
  public static clearCaches(): void {
    SensitiveKeyCache.clearCache();
    logger.debug('Sanitization caches cleared');
  }

  // === UTILITY METHODS ===

  /**
   * Sanitize headers (simplified)
   */
  public static sanitizeHeaders(headers: unknown): Record<string, unknown> {
    if (!headers || typeof headers !== 'object') return {};
    return this.sanitizeData(headers as Record<string, unknown>);
  }

  /**
   * Sanitize string values by removing dangerous characters
   */
  public static sanitizeString(value: string): string {
    if (!value || typeof value !== 'string') return '';
    return value.replace(/["'\\<>]/g, '').trim();
  }

  /**
   * Create a Winston logger sanitizer function
   */
  public static createLogSanitizer(): (info: Record<string, unknown>) => Record<string, unknown> {
    return (info: Record<string, unknown>) => this.sanitizeData(info);
  }

  // === ADDITIONAL METHODS (keeping existing functionality) ===

  /**
   * Sanitizes data by specific paths (e.g., "user.credentials.password")
   */
  public static sanitizeByPaths<T extends Record<string, unknown>>(
    data: T,
    paths: string[],
    maskValue: string = this.defaultSanitizationParams.maskValue || MaskValue,
  ): T {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return data;
      }

      if (!Array.isArray(paths) || paths.length === 0) {
        logger.warn('No valid paths provided for sanitization');
        return data;
      }

      const result = this.safeDeepCopy(data);
      if (!result) return data;

      paths.forEach((path) => {
        if (typeof path === 'string' && path.trim()) {
          this.processSinglePath(result, path.trim(), maskValue);
        }
      });

      return result;
    } catch (error) {
      ErrorHandler.captureError(error, 'sanitizeByPaths', 'Failed to sanitize by paths');
      return data;
    }
  }

  /**
   * Sanitizes data by specific key-value pairs, including nested objects
   */
  public static sanitizeByKeyValuePairs<T extends Record<string, unknown>>(
    data: T,
    keysOrKeyValuePairs: string[] | Record<string, string | number>,
    maskValue: string = this.defaultSanitizationParams.maskValue || MaskValue,
  ): T {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return data;
      }

      if (!keysOrKeyValuePairs) {
        logger.warn('No key-value pairs provided for sanitization');
        return data;
      }

      const keyValuePairs: Record<string, string | number> = Array.isArray(keysOrKeyValuePairs)
        ? this.extractKeyValuePairs(data, keysOrKeyValuePairs)
        : keysOrKeyValuePairs;

      if (Object.keys(keyValuePairs).length === 0) {
        return data;
      }

      const result = this.safeDeepCopy(data);
      if (!result) return data;

      this.applyKeyValueMaskingRecursive(result, keyValuePairs, maskValue);

      return result;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'sanitizeByKeyValuePairs',
        'Failed to sanitize by key-value pairs',
      );
      return data;
    }
  }

  // === PRIVATE HELPER METHODS ===

  /**
   * Safe deep copy with error handling
   */
  private static safeDeepCopy<T>(data: T): T | null {
    try {
      return JSON.parse(JSON.stringify(data)) as T;
    } catch (error) {
      ErrorHandler.captureError(error, 'safeDeepCopy', 'Failed to create deep copy of data');
      return null;
    }
  }

  /**
   * Apply masking to key-value pairs recursively through an object
   */
  private static applyKeyValueMaskingRecursive(
    obj: Record<string, unknown>,
    keyValuePairs: Record<string, string | number>,
    maskValue: string,
  ): void {
    try {
      // Handle the current level
      for (const [key, valueToMask] of Object.entries(keyValuePairs)) {
        if (key in obj && obj[key] === valueToMask) {
          obj[key] = maskValue;
        }
      }

      // Recursively process nested objects
      for (const [_key, value] of Object.entries(obj)) {
        if (value !== null && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
                this.applyKeyValueMaskingRecursive(
                  item as Record<string, unknown>,
                  keyValuePairs,
                  maskValue,
                );
              }
            });
          } else {
            this.applyKeyValueMaskingRecursive(
              value as Record<string, unknown>,
              keyValuePairs,
              maskValue,
            );
          }
        }
      }
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'applyKeyValueMaskingRecursive',
        'Failed to apply key-value masking',
      );
      throw error;
    }
  }

  /**
   * Process a single path for path-based sanitization
   */
  private static processSinglePath(
    obj: Record<string, unknown>,
    path: string,
    maskValue: string,
  ): void {
    try {
      const parts = path.split('.');
      let current: Record<string, unknown> = obj;

      // Navigate to the parent object
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (
          current[part] === undefined ||
          current[part] === null ||
          typeof current[part] !== 'object'
        ) {
          return; // Path doesn't exist or is invalid
        }
        current = current[part] as Record<string, unknown>;
      }

      // Set the value if we can reach it
      const lastPart = parts[parts.length - 1];
      if (lastPart in current) {
        current[lastPart] = maskValue;
      }
    } catch (error) {
      ErrorHandler.captureError(error, 'processSinglePath', `Failed to process path: ${path}`);
      throw error;
    }
  }

  /**
   * Extracts key-value pairs from the provided data object based on the given sensitive keys
   */
  private static extractKeyValuePairs<T extends Record<string, unknown>>(
    data: T,
    sensitiveKeys: Array<keyof T>,
  ): Record<string, string | number> {
    try {
      return sensitiveKeys.reduce(
        (acc, key) => {
          try {
            const value = data[key];
            if (typeof value === 'string' || typeof value === 'number') {
              acc[key as string] = value;
            }
          } catch (error) {
            logger.error(`Failed to extract key-value pair for key: ${String(key)}`, {
              error: error instanceof Error ? error.message : String(error),
              key: String(key),
            });
          }
          return acc;
        },
        {} as Record<string, string | number>,
      );
    } catch (error) {
      ErrorHandler.captureError(error, 'extractKeyValuePairs', 'Failed to extract key-value pairs');
      return {};
    }
  }
}
