import * as interfaces from '../../config/coreTypes/errors/error-handler.types';
import { ErrorCategory } from '../../config/coreTypes/errors/error-category.enum';
import { CustomError } from './customError';
import DataSanitizer from '../sanitization/dataSanitizer';

export default class ErrorProcessor {
  /**
   * Create a standardized error object with source, context, message, and category.
   * HTTP details are added if the error is an Axios error.
   * @param error - The error object to process.
   * @param source - The source of the error.
   * @param context - The context of the error (optional).
   * @returns A structured error object with source, context, message, and category.
   */
  public static createErrorDetails(
    error: unknown,
    source: string,
    context?: string,
  ): interfaces.ErrorDetails {
    // Analyze the error to get category and context
    const analysis = this.analyzeError(error);

    // Base error details
    const details: interfaces.ErrorDetails = {
      source,
      context: context || analysis.context,
      message: this.getErrorMessage(error),
      category: analysis.category,
      timestamp: new Date().toISOString(),
      environment: process.env.ENV || 'dev',
      version: process.env.APP_VERSION,
    };

    return details;
  }

  /**
   * Clean any error message by stripping ANSI sequences and keeping only first line
   */
  public static cleanMessage(message: string): string {
    if (!message) return '';

    // First sanitize the string using SanitizationConfig
    let cleaned = DataSanitizer.sanitizeString(message);

    // Strip ANSI escape sequences
    // Using the decimal code for ESC (27) in a character class
    const ESC = String.fromCharCode(27);
    cleaned = cleaned.replace(
      new RegExp(ESC + '\\[\\d+(?:;\\d+)*m|' + ESC + '\\??[0-9;]*[A-Za-z]', 'g'),
      '',
    );

    // Strip error prefix and quotes
    cleaned = cleaned.replace(/^'Error: |^'|'$/g, '');

    // Only keep first line (common pattern in stacktraces)
    return cleaned.split('\n')[0];
  }

  /**
   * Get the error message from any error type
   */
  public static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return this.cleanMessage(error.message);
    }

    if (typeof error === 'string') {
      return this.cleanMessage(error);
    }

    // Handle error-like objects
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;

      // Try different message properties
      const messageProps = ['message', 'error', 'description', 'detail'];
      for (const prop of messageProps) {
        if (typeof errorObj[prop] === 'string') {
          return this.cleanMessage(errorObj[prop]);
        }
      }

      // Try to stringify if it looks like an error object
      if ('name' in errorObj || 'code' in errorObj) {
        return this.cleanMessage(JSON.stringify(errorObj));
      }
    }

    return 'Unknown error occurred';
  }

  /**
   * Create a cache key for error deduplication
   */
  public static createCacheKey(details: interfaces.ErrorDetails): string {
    return `${details.source}_${details.category}_${
      details.statusCode || '0'
    }_${details.message.substring(0, 30)}`;
  }

  /**
   * Extract additional details from error objects
   */
  public static extractExtraDetails(error: unknown): Record<string, unknown> {
    // Handle Playwright matcher results
    if (this.isPlaywrightError(error)) {
      return this.extractPlaywrightDetails(error);
    }

    // Handle general objects
    if (typeof error === 'object' && error !== null) {
      return this.sanitizeObject(error as Record<string, unknown>);
    }

    return {};
  }

  /**
   * Sanitize object for safe logging, using SanitizationConfig
   */
  public static sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    if (!obj) return {};

    // Define custom sanitization parameters
    const customSanitizationParams = {
      ...DataSanitizer.getDefaultParams(),
      skipProperties: ['stack'],
      truncateUrls: true,
      maxStringLength: 1000,
    };

    // Use a single sanitization call
    return DataSanitizer.sanitizeData(obj, customSanitizationParams);
  }

  // PRIVATE HELPER METHODS BELOW

  private static analyzeError(error: unknown): { category: ErrorCategory; context: string } {
    // Check for native JavaScript errors first (common in browser automation)
    const jsErrorResult = this.analyzeJavaScriptError(error);
    if (jsErrorResult.category !== ErrorCategory.UNKNOWN) {
      return jsErrorResult;
    }

    // Check for Playwright-specific errors (highest priority for UI automation)
    if (this.isPlaywrightError(error)) {
      return this.analyzePlaywrightError(error);
    }

    // Check for browser-specific errors
    const browserErrorResult = this.analyzeBrowserError(error);
    if (browserErrorResult.category !== ErrorCategory.UNKNOWN) {
      return browserErrorResult;
    }

    // Check for HTTP/API errors (important for API testing)
    const httpErrorResult = this.analyzeHttpError(error);
    if (httpErrorResult.category !== ErrorCategory.UNKNOWN) {
      return httpErrorResult;
    }

    // Check for system errors with codes
    if (error instanceof Error && 'code' in error) {
      const systemResult = this.analyzeSystemError(error as Error & { code?: string | undefined });
      if (systemResult) return systemResult;
    }

    // Check for timeout patterns (critical in UI automation)
    if (this.isTimeoutError(error)) {
      return {
        category: ErrorCategory.TIMEOUT,
        context: 'Timeout Error',
      };
    }

    // Handle CustomError/AppError
    if (error instanceof CustomError) {
      return this.analyzeAppError(error);
    }

    // Analyze error message for patterns
    const messageAnalysisResult = this.analyzeErrorMessage(error);
    if (messageAnalysisResult.category !== ErrorCategory.UNKNOWN) {
      return messageAnalysisResult;
    }

    // Default fallback with error name if available
    const result = {
      category: ErrorCategory.UNKNOWN,
      context: 'General Error',
    };

    if (error instanceof Error && error.name) {
      result.context = `${error.name} Error`;
    }

    return result;
  }
  private static analyzePlaywrightError(
    error: Error & { matcherResult?: interfaces.PlaywrightMatcherResult },
  ): { category: ErrorCategory; context: string } {
    const errorMessage = error.message.toLowerCase();

    // Screenshot-specific errors
    if (
      errorMessage.includes('screenshot') ||
      (error.matcherResult?.name && error.matcherResult.name.includes('screenshot'))
    ) {
      return {
        category: ErrorCategory.SCREENSHOT_ERROR,
        context: 'Playwright Screenshot Error',
      };
    }

    // Download/Upload errors
    if (errorMessage.includes('download') || errorMessage.includes('waitForDownload')) {
      return {
        category: ErrorCategory.DOWNLOAD_ERROR,
        context: 'Playwright Download Error',
      };
    }

    if (errorMessage.includes('upload') || errorMessage.includes('setInputFiles')) {
      return {
        category: ErrorCategory.UPLOAD_ERROR,
        context: 'Playwright Upload Error',
      };
    }

    // Navigation errors
    if (
      errorMessage.includes('goto') ||
      errorMessage.includes('navigation') ||
      errorMessage.includes('waitForNavigation')
    ) {
      return {
        category: ErrorCategory.NAVIGATION,
        context: 'Playwright Navigation Error',
      };
    }

    // Locator errors - check for specific patterns
    if (errorMessage.includes('locator.')) {
      // More specific locator error analysis
      if (errorMessage.includes('locator.fill') || errorMessage.includes('locator.type')) {
        return {
          category: ErrorCategory.ELEMENT,
          context: 'Playwright Input Error',
        };
      }

      if (errorMessage.includes('locator.click')) {
        return {
          category: ErrorCategory.ELEMENT,
          context: 'Playwright Click Error',
        };
      }

      return {
        category: ErrorCategory.LOCATOR,
        context: 'Playwright Locator Error',
      };
    }

    // Selector errors
    if (
      errorMessage.includes('selector') ||
      errorMessage.includes('invalid selector') ||
      errorMessage.includes('selector resolved to')
    ) {
      return {
        category: ErrorCategory.SELECTOR,
        context: 'Playwright Selector Error',
      };
    }

    // Element visibility/interaction errors
    if (
      errorMessage.includes('not visible') ||
      errorMessage.includes('not attached') ||
      errorMessage.includes('element is not attached')
    ) {
      return {
        category: ErrorCategory.ELEMENT,
        context: 'Playwright Element State Error',
      };
    }

    // Timeout errors in Playwright context
    if (this.isTimeoutError(error)) {
      return {
        category: ErrorCategory.TIMEOUT,
        context: 'Playwright Timeout Error',
      };
    }

    // Generic Playwright test/assertion error
    return {
      category: ErrorCategory.TEST,
      context: `Playwright Test Error: ${error.matcherResult?.name || 'Unknown'}`,
    };
  }

  /**
   * Analyze Node.js system errors
   */
  private static analyzeSystemError(
    error: Error & { code?: string | undefined },
  ): { category: ErrorCategory; context: string } | null {
    if (!error.code) return null;

    const systemCategory = this.getSystemErrorCategory(error);
    if (systemCategory) {
      return {
        category: systemCategory,
        context: this.getContextFromSystemError(error),
      };
    }

    return null;
  }

  /**
   * Check if an error is a timeout error based on its message
   */
  private static isTimeoutError(error: unknown): boolean {
    const errorMessage =
      typeof error === 'string'
        ? error.toLowerCase()
        : error instanceof Error
          ? error.message.toLowerCase()
          : String(error).toLowerCase();

    return (
      errorMessage.includes('timeout') &&
      (errorMessage.includes('exceeded') || errorMessage.includes('timed out'))
    );
  }

  /**
   * Analyze AppError instances
   */
  private static analyzeAppError(error: CustomError): { category: ErrorCategory; context: string } {
    return {
      category:
        error.category in ErrorCategory ? (error.category as ErrorCategory) : ErrorCategory.UNKNOWN,
      context: `App Error: ${(error.category as string) || 'Unknown'}`,
    };
  }

  /**
   * Analyze error messages for patterns that indicate specific categories
   */
  private static analyzeErrorMessage(error: unknown): { category: ErrorCategory; context: string } {
    const result = {
      category: ErrorCategory.UNKNOWN,
      context: 'General Error',
    };

    const errorMessage =
      typeof error === 'string'
        ? error.toLowerCase()
        : error instanceof Error
          ? error.message.toLowerCase()
          : String(error).toLowerCase();

    // Check against our category-keyword map
    const categoryMatch = this.findCategoryFromErrorMessage(errorMessage);
    if (categoryMatch) {
      result.category = categoryMatch.category;
      result.context = categoryMatch.context;
    }

    return result;
  }

  private static findCategoryFromErrorMessage(
    errorMessage: string,
  ): { category: ErrorCategory; context: string } | null {
    const normalized = errorMessage.toLowerCase().trim();

    // Playwright-optimized category-context mapping
    const categoryContextMap = [
      // Browser and page errors (highest priority for UI automation)
      {
        category: ErrorCategory.BROWSER_ERROR,
        context: 'Browser Error',
        keywords: [
          'browser closed',
          'browser crashed',
          'chromium',
          'firefox',
          'webkit',
          'browser context',
        ],
      },
      {
        category: ErrorCategory.PAGE_ERROR,
        context: 'Page Error',
        keywords: ['page closed', 'page crashed', 'page.goto', 'page navigation', 'target page'],
      },
      {
        category: ErrorCategory.FRAME_ERROR,
        context: 'Frame Error',
        keywords: ['frame detached', 'frame not found', 'iframe', 'frame.locator'],
      },

      // UI interaction errors
      {
        category: ErrorCategory.ELEMENT,
        context: 'Element Interaction Error',
        keywords: [
          'element not visible',
          'element not attached',
          'element is not attached',
          'not interactable',
        ],
      },
      {
        category: ErrorCategory.LOCATOR,
        context: 'Locator Error',
        keywords: [
          'locator.fill',
          'locator.click',
          'locator.type',
          'locator.clear',
          'locator not found',
        ],
      },
      {
        category: ErrorCategory.SELECTOR,
        context: 'Selector Error',
        keywords: [
          'invalid selector',
          'selector resolved to',
          'malformed selector',
          'css selector',
        ],
      },

      // File operations (common in UI testing)
      {
        category: ErrorCategory.SCREENSHOT_ERROR,
        context: 'Screenshot Error',
        keywords: [
          'screenshot failed',
          'screenshot timeout',
          'screenshot error',
          'page.screenshot',
        ],
      },
      {
        category: ErrorCategory.DOWNLOAD_ERROR,
        context: 'Download Error',
        keywords: ['download failed', 'download timeout', 'waitForDownload', 'download error'],
      },
      {
        category: ErrorCategory.UPLOAD_ERROR,
        context: 'Upload Error',
        keywords: ['upload failed', 'upload timeout', 'setInputFiles', 'file upload'],
      },

      // Dialog and interaction
      {
        category: ErrorCategory.DIALOG,
        context: 'Dialog Error',
        keywords: ['dialog', 'alert', 'confirm', 'prompt', 'page.on(dialog)'],
      },

      // Network and API errors
      {
        category: ErrorCategory.INTERCEPT,
        context: 'Network Interception Error',
        keywords: ['route', 'intercept', 'page.route', 'request interception', 'mock response'],
      },
      {
        category: ErrorCategory.CORS,
        context: 'CORS Error',
        keywords: ['cors', 'cross-origin', 'access-control-allow-origin', 'preflight'],
      },
      {
        category: ErrorCategory.TOKEN_EXPIRED,
        context: 'Token Expired Error',
        keywords: ['token expired', 'jwt expired', 'token invalid', 'access token'],
      },

      // Test execution
      {
        category: ErrorCategory.RETRY_EXHAUSTED,
        context: 'Retry Exhausted Error',
        keywords: ['retry exhausted', 'max retries', 'all retries failed', 'retry limit'],
      },
      {
        category: ErrorCategory.FIXTURE,
        context: 'Test Fixture Error',
        keywords: ['fixture failed', 'before each', 'after each', 'setup failed'],
      },

      // Mobile-specific
      {
        category: ErrorCategory.MOBILE_DEVICE,
        context: 'Mobile Device Error',
        keywords: ['mobile', 'device emulation', 'viewport', 'touch', 'mobile context'],
      },
      {
        category: ErrorCategory.MOBILE_CONTEXT,
        context: 'Mobile Context Error',
        keywords: ['mobile context', 'device context', 'emulation failed'],
      },

      // HTTP errors (important for API testing)
      {
        category: ErrorCategory.RATE_LIMIT,
        context: 'Rate Limit Error',
        keywords: ['rate limit', 'too many requests', 'quota exceeded', 'throttled', '429'],
      },
      {
        category: ErrorCategory.HTTP_CLIENT,
        context: 'HTTP Client Error',
        keywords: ['400', '401', '403', '404', '409', '422', 'client error'],
      },
      {
        category: ErrorCategory.HTTP_SERVER,
        context: 'HTTP Server Error',
        keywords: ['500', '502', '503', '504', 'server error', 'internal server'],
      },

      // Timeout (critical in UI automation)
      {
        category: ErrorCategory.TIMEOUT,
        context: 'Timeout Error',
        keywords: [
          'timeout',
          'timed out',
          'timeout exceeded',
          'wait timeout',
          'navigation timeout',
        ],
      },

      // Authentication/Authorization
      {
        category: ErrorCategory.AUTHENTICATION,
        context: 'Authentication Error',
        keywords: ['authentication failed', 'login failed', 'unauthorized', 'invalid credentials'],
      },
      {
        category: ErrorCategory.AUTHORIZATION,
        context: 'Authorization Error',
        keywords: ['authorization failed', 'forbidden', 'access denied', 'permission denied'],
      },

      // Data and validation
      {
        category: ErrorCategory.VALIDATION,
        context: 'Validation Error',
        keywords: ['validation', 'invalid', 'schema', 'malformed', 'validation failed'],
      },
      {
        category: ErrorCategory.PARSING,
        context: 'Parsing Error',
        keywords: ['parse error', 'json parse', 'xml parse', 'parsing failed'],
      },
      {
        category: ErrorCategory.FORMAT_ERROR,
        context: 'Format Error',
        keywords: ['format error', 'invalid format', 'malformed data', 'format mismatch'],
      },

      // External services
      {
        category: ErrorCategory.THIRD_PARTY_SERVICE,
        context: 'Third Party Service Error',
        keywords: ['third party', 'external service', 'api error', 'service unavailable'],
      },
      {
        category: ErrorCategory.WEBHOOK_ERROR,
        context: 'Webhook Error',
        keywords: ['webhook failed', 'webhook timeout', 'webhook error'],
      },

      // Performance and resources
      {
        category: ErrorCategory.MEMORY,
        context: 'Memory Error',
        keywords: ['out of memory', 'memory', 'heap', 'allocation failed'],
      },
      {
        category: ErrorCategory.PERFORMANCE,
        context: 'Performance Error',
        keywords: ['performance', 'slow', 'performance budget', 'metrics'],
      },

      // Configuration and environment
      {
        category: ErrorCategory.CONFIGURATION,
        context: 'Configuration Error',
        keywords: [
          'config',
          'configuration',
          'environment variable',
          'missing setting',
          'playwright.config',
        ],
      },
      {
        category: ErrorCategory.ENVIRONMENT,
        context: 'Environment Error',
        keywords: ['environment', 'env', 'missing dependency', 'path not found'],
      },

      // Generic fallbacks
      {
        category: ErrorCategory.NOT_FOUND,
        context: 'Not Found Error',
        keywords: ['not found', 'does not exist', 'missing', 'no such'],
      },
      {
        category: ErrorCategory.NETWORK,
        context: 'Network Error',
        keywords: ['network error', 'network failure', 'dns', 'host unreachable'],
      },
    ];

    // Use exact phrase matching first, then partial matching
    for (const mapping of categoryContextMap) {
      for (const keyword of mapping.keywords) {
        // Exact match or word boundary match
        if (
          normalized === keyword ||
          (normalized.includes(keyword) &&
            new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`).test(normalized))
        ) {
          return {
            category: mapping.category,
            context: mapping.context,
          };
        }
      }
    }

    return null;
  }

  private static getSystemErrorCategory(error: Error & { code?: string }): ErrorCategory | null {
    if (!error.code) return null;

    const codeMap: Record<string, ErrorCategory> = {
      // File system errors (important for screenshots, downloads, reports)
      ENOENT: ErrorCategory.FILE_NOT_FOUND,
      EEXIST: ErrorCategory.FILE_EXISTS,
      EACCES: ErrorCategory.ACCESS_DENIED,
      EFBIG: ErrorCategory.FILE_TOO_LARGE,

      // Network error codes (for API testing)
      ECONNREFUSED: ErrorCategory.CONNECTION,
      ECONNRESET: ErrorCategory.CONNECTION,
      ETIMEDOUT: ErrorCategory.TIMEOUT,
      EHOSTUNREACH: ErrorCategory.NETWORK,
      ENETUNREACH: ErrorCategory.NETWORK,

      // Permission and security
      EPERM: ErrorCategory.SECURITY_ERROR,
    };

    return codeMap[error.code] || null;
  }

  private static getContextFromSystemError(error: Error & { code?: string }): string {
    if (!error.code) return 'System Error';

    const contextMap: Record<string, string> = {
      ENOENT: 'File Not Found Error',
      EEXIST: 'File Already Exists Error',
      EACCES: 'File Access Denied Error',
      EFBIG: 'File Too Large Error',
      ECONNREFUSED: 'Connection Refused Error',
      ECONNRESET: 'Connection Reset Error',
      ETIMEDOUT: 'Connection Timeout Error',
      EHOSTUNREACH: 'Host Unreachable Error',
      ENETUNREACH: 'Network Unreachable Error',
      EPERM: 'Permission Denied Error',
    };

    return contextMap[error.code] || 'System Error';
  }

  /**
   * Type guard to safely check if an error is a Playwright error
   */
  private static isPlaywrightError(error: unknown): error is Error & {
    matcherResult?: interfaces.PlaywrightMatcherResult;
  } {
    return error instanceof Error && 'matcherResult' in error;
  }

  /**
   * Extract details from Playwright errors
   */
  private static extractPlaywrightDetails(
    error: Error & { matcherResult?: interfaces.PlaywrightMatcherResult },
  ): Record<string, unknown> {
    const matcher = error.matcherResult;

    if (!matcher) {
      return {};
    }

    return {
      name: matcher.name,
      pass: matcher.pass,
      expected: matcher.expected,
      actual: matcher.actual,
      message: matcher.message ? this.cleanMessage(matcher.message) : undefined,
      log: Array.isArray(matcher.log)
        ? matcher.log
            .filter((entry) => !entry.includes('http'))
            .map((entry) => this.cleanMessage(entry))
        : undefined,
    };
  }

  private static analyzeJavaScriptError(error: unknown): {
    category: ErrorCategory;
    context: string;
  } {
    if (!(error instanceof Error)) {
      return { category: ErrorCategory.UNKNOWN, context: 'General Error' };
    }

    // Map JavaScript error types to categories
    const jsErrorMap: Record<string, { category: ErrorCategory; context: string }> = {
      TypeError: { category: ErrorCategory.TYPE_ERROR, context: 'Type Error' },
      ReferenceError: { category: ErrorCategory.REFERENCE_ERROR, context: 'Reference Error' },
      SyntaxError: { category: ErrorCategory.SYNTAX_ERROR, context: 'Syntax Error' },
      RangeError: { category: ErrorCategory.RANGE_ERROR, context: 'Range Error' },
    };

    const errorMapping = jsErrorMap[error.name];
    if (errorMapping) {
      return errorMapping;
    }

    return { category: ErrorCategory.UNKNOWN, context: 'General Error' };
  }

  /**
   * NEW METHOD: Analyze browser-specific errors
   */
  private static analyzeBrowserError(error: unknown): { category: ErrorCategory; context: string } {
    const errorMessage = this.getErrorMessage(error).toLowerCase();

    // Browser crash/closure patterns
    if (
      errorMessage.includes('browser has been closed') ||
      errorMessage.includes('browser closed') ||
      errorMessage.includes('browser crashed')
    ) {
      return { category: ErrorCategory.BROWSER_ERROR, context: 'Browser Closed Error' };
    }

    // Page-related errors
    if (
      errorMessage.includes('page has been closed') ||
      errorMessage.includes('page closed') ||
      errorMessage.includes('target page')
    ) {
      return { category: ErrorCategory.PAGE_ERROR, context: 'Page Closed Error' };
    }

    // Frame-related errors
    if (
      errorMessage.includes('frame') &&
      (errorMessage.includes('detached') || errorMessage.includes('not found'))
    ) {
      return { category: ErrorCategory.FRAME_ERROR, context: 'Frame Error' };
    }

    // Dialog handling errors
    if (
      errorMessage.includes('dialog') ||
      errorMessage.includes('alert') ||
      errorMessage.includes('confirm') ||
      errorMessage.includes('prompt')
    ) {
      return { category: ErrorCategory.DIALOG, context: 'Dialog Handling Error' };
    }

    // Network interception errors
    if (
      errorMessage.includes('route') ||
      errorMessage.includes('intercept') ||
      errorMessage.includes('mock') ||
      errorMessage.includes('request interception')
    ) {
      return { category: ErrorCategory.INTERCEPT, context: 'Network Interception Error' };
    }

    // Mobile context errors
    if (
      errorMessage.includes('mobile') ||
      errorMessage.includes('device') ||
      (errorMessage.includes('viewport') && errorMessage.includes('mobile'))
    ) {
      return { category: ErrorCategory.MOBILE_DEVICE, context: 'Mobile Device Error' };
    }

    return { category: ErrorCategory.UNKNOWN, context: 'General Error' };
  }

  private static analyzeHttpError(error: unknown): { category: ErrorCategory; context: string } {
    const errorMessage = this.getErrorMessage(error).toLowerCase();

    // Check for HTTP status code patterns
    if (error && typeof error === 'object') {
      // Define proper types for different error structures
      interface AxiosLikeError {
        response?: {
          status?: number;
        };
      }

      interface StatusError {
        status?: number;
        statusCode?: number;
      }

      // Type guard for Axios-style errors
      function isAxiosLikeError(obj: object): obj is AxiosLikeError {
        return (
          'response' in obj &&
          obj.response !== null &&
          typeof obj.response === 'object' &&
          'status' in obj.response
        );
      }

      // Type guard for status errors
      function isStatusError(obj: object): obj is StatusError {
        return 'status' in obj || 'statusCode' in obj;
      }

      // Axios-style errors
      if (isAxiosLikeError(error)) {
        const status = error.response?.status;
        if (typeof status === 'number') {
          if (status >= 400 && status < 500) {
            // Handle specific 4xx errors
            switch (status) {
              case 401:
                return {
                  category: ErrorCategory.AUTHENTICATION,
                  context: 'Authentication Error (401)',
                };
              case 403:
                return {
                  category: ErrorCategory.AUTHORIZATION,
                  context: 'Authorization Error (403)',
                };
              case 404:
                return { category: ErrorCategory.NOT_FOUND, context: 'Not Found Error (404)' };
              case 409:
                return { category: ErrorCategory.CONFLICT, context: 'Conflict Error (409)' };
              case 429:
                return { category: ErrorCategory.RATE_LIMIT, context: 'Rate Limit Error (429)' };
              default:
                return { category: ErrorCategory.HTTP_CLIENT, context: `Client Error (${status})` };
            }
          } else if (status >= 500) {
            return { category: ErrorCategory.HTTP_SERVER, context: `Server Error (${status})` };
          }
        }
      }

      // Check for status code in error properties
      if (isStatusError(error)) {
        const status = error.status ?? error.statusCode;
        if (typeof status === 'number') {
          if (status >= 400 && status < 500) {
            return { category: ErrorCategory.HTTP_CLIENT, context: `Client Error (${status})` };
          } else if (status >= 500) {
            return { category: ErrorCategory.HTTP_SERVER, context: `Server Error (${status})` };
          }
        }
      }
    }

    // CORS errors (common in web testing)
    if (
      errorMessage.includes('cors') ||
      errorMessage.includes('cross-origin') ||
      errorMessage.includes('access-control-allow-origin')
    ) {
      return { category: ErrorCategory.CORS, context: 'CORS Error' };
    }

    // Token/JWT errors
    if (
      errorMessage.includes('token expired') ||
      errorMessage.includes('jwt expired') ||
      errorMessage.includes('token invalid')
    ) {
      return { category: ErrorCategory.TOKEN_EXPIRED, context: 'Token Expired Error' };
    }

    // API version errors
    if (
      errorMessage.includes('api version') ||
      errorMessage.includes('version not supported') ||
      errorMessage.includes('deprecated api')
    ) {
      return { category: ErrorCategory.API_VERSION_ERROR, context: 'API Version Error' };
    }

    return { category: ErrorCategory.UNKNOWN, context: 'General Error' };
  }
}
