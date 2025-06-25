interface LoggerConfig {
  /** Maximum log file size in bytes (default: 10MB) */
  LOG_FILE_LIMIT: number;

  /** Timezone for logging timestamps */
  TIME_ZONE: string;

  /** Date format for log timestamps */
  DATE_FORMAT: string;

  /** Logging levels */
  LOG_LEVEL_INFO: string;
  LOG_LEVEL_ERROR: string;
  LOG_LEVEL_WARN: string;
  LOG_LEVEL_DEBUG: string;

  /** Log file paths and directory */
  LOG_DIR: string;
  LOG_FILE_INFO: string;
  LOG_FILE_ERROR: string;
  LOG_FILE_WARN: string;
  LOG_FILE_DEBUG: string;
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  // Size limit (10MB in bytes)
  LOG_FILE_LIMIT: 10 * 1024 * 1024,

  // Time settings
  TIME_ZONE: 'Africa/Johannesburg',
  DATE_FORMAT: 'YYYY-MM-DDTHH:mm:ssZ',

  // Log levels
  LOG_LEVEL_INFO: 'info',
  LOG_LEVEL_ERROR: 'error',
  LOG_LEVEL_WARN: 'warn',
  LOG_LEVEL_DEBUG: 'debug',

  // Log file paths
  LOG_DIR: 'logs',
  LOG_FILE_INFO: 'log_info.log',
  LOG_FILE_ERROR: 'log_error.log',
  LOG_FILE_WARN: 'log_warn.log',
  LOG_FILE_DEBUG: 'log_debug.log',
};

export interface LoggerMetadata {
  userId?: string | number;
  sessionId?: string;
  module?: string;
  requestId?: string;
  correlationId?: string;
  [key: string]: string | number | boolean | undefined;
}