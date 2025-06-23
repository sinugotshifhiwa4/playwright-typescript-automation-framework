import { MaskValue, NeverTruncateDefaultKeys } from './sanitization.constants.ts';

/**
 * Authentication & Authorization sensitive keys
 */
export const AuthSensitiveKeys = [
  'password',
  'passwd',
  'pwd',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'auth',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'bearerToken',
  'bearer_token',
  'cookie',
  'jwt',
  'session',
  'sessionId',
  'session_id',
];

/**
 * Personal Information sensitive keys
 */
export const PersonalInfoSensitiveKeys = [
  'idNumber',
  'ssn',
  'id_number',
  'identityNumber',
  'identity_number',
  'creditCard',
  'credit_card',
  'ccNumber',
  'cardNumber',
  'cvv',
  'pin',
];

/**
 * Database & Infrastructure sensitive keys
 */
export const DatabaseSensitiveKeys = [
  'connectionString',
  'connection_string',
  'db_username',
  'dbUsername',
  'dbPassword',
  'db_password',
  'privateKey',
  'private_key',
  'encryptionKey',
  'encryption_key',
];

/**
 * Cloud & Services sensitive keys
 */
export const CloudServicesSensitiveKeys = [
  'awsAccessKey',
  'aws_access_key',
  'awsSecretKey',
  'aws_secret_key',
  'gcpKey',
  'gcp_key',
  'azureKey',
  'azure_key',
];

/**
 * Combined list of all sensitive keys
 */
export const DefaultSensitiveKeys = [
  ...AuthSensitiveKeys,
  ...PersonalInfoSensitiveKeys,
  ...DatabaseSensitiveKeys,
  ...CloudServicesSensitiveKeys,
];

/**
 * Sensitive patterns grouped by category
 */
export const SensitivePatterns = {
  // Financial patterns
  financial: [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  ],

  // Authentication patterns
  auth: [
    /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, // JWT
    /^[A-Za-z0-9+/]{20,}={0,2}$/, // Base64 encoded strings
  ],

  // Cloud service patterns
  cloud: [
    /AKIA[0-9A-Z]{16}/, // AWS Access Key
    /ghp_[0-9a-zA-Z]{36}/, // GitHub token
    /sk_[a-zA-Z0-9]{32,}/, // Secret API key
    /pk_[a-zA-Z0-9]{32,}/, // Public API key
  ],

  // Contact information
  contact: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  ],
};

/**
 * Flattened array of all sensitive patterns
 */
export const DefaultSensitivePatterns: RegExp[] = [
  ...SensitivePatterns.financial,
  ...SensitivePatterns.auth,
  ...SensitivePatterns.cloud,
  ...SensitivePatterns.contact,
];

/**
 * Configuration object for easy access to specific categories
 */
export const SensitiveConfig = {
  keys: {
    auth: AuthSensitiveKeys,
    personalInfo: PersonalInfoSensitiveKeys,
    database: DatabaseSensitiveKeys,
    cloudServices: CloudServicesSensitiveKeys,
    all: DefaultSensitiveKeys,
  },
  patterns: SensitivePatterns,
  neverTruncate: NeverTruncateDefaultKeys,
  maskValue: MaskValue,
};
