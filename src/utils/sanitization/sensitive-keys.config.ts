const authenticationKeys = [
  'password',
  'apiKey',
  'secret',
  'secretKey',
  'authorization',
  'auth',
  'token',
  'accessToken',
  'refreshToken',
  'bearerToken',
  'cookie',
  'jwt',
  'dbPassword',
  'privateKey',
];

const personalInfoKeys = [
  'ssn',
  'idNumber',
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

export const defaultSensitiveKeys = [...authenticationKeys, ...personalInfoKeys];

export const defaultSensitivePatterns = [
  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  // Social Security Numbers
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  // JWT tokens
  /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  // Base64 encoded strings
  /^[A-Za-z0-9+/]{20,}={0,2}$/,
  // GitHub tokens
  /ghp_[0-9a-zA-Z]{36}/,
  // API keys
  /sk_[a-zA-Z0-9]{32,}/,
  /pk_[a-zA-Z0-9]{32,}/,
];