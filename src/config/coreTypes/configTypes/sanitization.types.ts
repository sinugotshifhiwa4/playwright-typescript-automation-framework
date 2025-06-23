export interface SanitizationParams {
  // Core sanitization properties
  sensitiveKeys: string[];
  maskValue: string;
  skipProperties?: string[];
  truncateUrls?: boolean;
  maxStringLength?: number;
  neverTruncateKeys?: string[];
  enablePatternDetection?: boolean;
  customPatterns?: RegExp[];
  reportingEnabled?: boolean;
  maxDepth?: number; // Prevent infinite recursion
  chunkSize?: number; // For large data processing
}

export interface SanitizationReport {
  keysProcessed: number;
  keysSanitized: number;
  sanitizedKeys: string[];
  patternsFound: string[];
  circularReferences: number;
}
