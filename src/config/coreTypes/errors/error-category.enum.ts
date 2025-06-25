
export enum ErrorCategory {
  // Database errors (for API testing with DB interactions)
  DATABASE = 'DATABASE_ERROR',
  CONNECTION = 'CONNECTION_ERROR',
  QUERY = 'QUERY_ERROR',
  CONSTRAINT = 'CONSTRAINT_ERROR',
  TRANSACTION = 'TRANSACTION_ERROR',
  
  // API and network errors (critical for both UI and API testing)
  NETWORK = 'NETWORK_ERROR',
  HTTP_CLIENT = 'HTTP_CLIENT_ERROR',         // 4xx errors
  HTTP_SERVER = 'HTTP_SERVER_ERROR',         // 5xx errors
  TIMEOUT = 'TIMEOUT_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  CORS = 'CORS_ERROR',                       // Common in web testing
  
  // Authentication and authorization (essential for modern apps)
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED_ERROR',     // JWT/OAuth scenarios
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND_ERROR',
  PERMISSION = 'PERMISSION_ERROR',
  CONFLICT = 'CONFLICT_ERROR',
  
  // UI and Browser errors (core Playwright functionality)
  BROWSER_ERROR = 'BROWSER_ERROR',
  PAGE_ERROR = 'PAGE_ERROR',
  FRAME_ERROR = 'FRAME_ERROR',
  ELEMENT = 'ELEMENT_ERROR',
  LOCATOR = 'LOCATOR_NOT_FOUND_ERROR',
  NAVIGATION = 'NAVIGATION_ERROR',
  SELECTOR = 'SELECTOR_ERROR',
  ASSERTION = 'ASSERTION_ERROR',
  SCREENSHOT_ERROR = 'SCREENSHOT_ERROR',
  DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  DIALOG = 'DIALOG_ERROR',                   // Alert/confirm/prompt handling
  INTERCEPT = 'INTERCEPT_ERROR',             // Network interception issues
  
  // Input/Output and data handling
  IO = 'IO_ERROR',
  PARSING = 'PARSING_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  SERIALIZATION = 'SERIALIZATION_ERROR',
  FORMAT_ERROR = 'FORMAT_ERROR',
  ENCODING_ERROR = 'ENCODING_ERROR',
  
  // Test execution and framework
  TEST = 'TEST_ERROR',
  SETUP = 'SETUP_ERROR',
  TEARDOWN = 'TEARDOWN_ERROR',
  FIXTURE = 'FIXTURE_ERROR',
  EXPECTED_FAILURE = 'EXPECTED_FAILURE',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED_ERROR', // When all retries fail
  
  // Performance (important for UI testing)
  PERFORMANCE = 'PERFORMANCE_ERROR',
  MEMORY = 'MEMORY_ERROR',
  RESOURCE_LIMIT = 'RESOURCE_LIMIT_ERROR',
  
  // Environment and configuration
  ENVIRONMENT = 'ENVIRONMENT_ERROR',
  DEPENDENCY = 'DEPENDENCY_ERROR',
  CONFIGURATION = 'CONFIGURATION_ERROR',
  
  // JavaScript Runtime errors (common in browser automation)
  TYPE_ERROR = 'TYPE_ERROR',
  REFERENCE_ERROR = 'REFERENCE_ERROR',
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  RANGE_ERROR = 'RANGE_ERROR',
  
  // File system (for downloads, uploads, screenshots, reports)
  FILE_NOT_FOUND = 'FILE_NOT_FOUND_ERROR',
  FILE_EXISTS = 'FILE_EXISTS_ERROR',
  ACCESS_DENIED = 'ACCESS_DENIED_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE_ERROR',
  
  // Security (for HTTPS, CSP, etc.)
  SECURITY_ERROR = 'SECURITY_ERROR',
  
  // Business logic and application state
  BUSINESS_RULE = 'BUSINESS_RULE_ERROR',
  
  // External services (APIs, webhooks, third-party integrations)
  THIRD_PARTY_SERVICE = 'THIRD_PARTY_SERVICE_ERROR',
  API_VERSION_ERROR = 'API_VERSION_ERROR',
  WEBHOOK_ERROR = 'WEBHOOK_ERROR',
  
  // Mobile-specific (if using Playwright for mobile)
  MOBILE_DEVICE = 'MOBILE_DEVICE_ERROR',
  MOBILE_CONTEXT = 'MOBILE_CONTEXT_ERROR',
  
  // Fallback
  UNKNOWN = 'UNKNOWN_ERROR',
}