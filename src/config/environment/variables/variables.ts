import EnvironmentVariablesValidator from './environmentVarsValidator';

export default class EnvironmentVariables {
  // URLS
  public static readonly API_BASE_URL = process.env.API_BASE_URL!;
  public static readonly PORTAL_BASE_URL = process.env.PORTAL_BASE_URL!;

  // Secret Keys
  public static readonly DEV_SECRET_KEY = process.env.DEV_SECRET_KEY!;
  public static readonly UAT_SECRET_KEY = process.env.UAT_SECRET_KEY!;
  public static readonly PROD_SECRET_KEY = process.env.PROD_SECRET_KEY!;

  // Users
  public static readonly ADMIN_USERNAME = process.env.ADMIN_USERNAME!;
  public static readonly ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;
  public static readonly PORTAL_USERNAME = process.env.PORTAL_USERNAME!;
  public static readonly PORTAL_PASSWORD = process.env.PORTAL_PASSWORD!;

  // Database
  public static readonly DB_SERVER = process.env.DB_SERVER!;
  public static readonly DATABASE_NAME = process.env.DATABASE_NAME!;
  public static readonly DB_USERNAME = process.env.DB_USERNAME!;
  public static readonly DB_PASSWORD = process.env.DB_PASSWORD!;
  public static readonly DB_PORT = process.env.DB_PORT!;
  public static readonly AZURE_DB_ENDPOINT = process.env.AZURE_DB_ENDPOINT!;

}

// Set the required variables for validation by EnvironmentConfigManager
process.env.REQUIRED_ENV_VARS = EnvironmentVariablesValidator['REQUIRED_VARIABLES']();
