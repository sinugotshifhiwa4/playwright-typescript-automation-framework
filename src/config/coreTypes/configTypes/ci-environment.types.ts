export interface CIEnvironmentConfig {
  urls: ServiceUrls;
  users: UserCredentialsSet;
  database: DatabaseConfig;
}

export interface ServiceUrls {
  apiBaseUrl: string;
  portalBaseUrl: string;
}

export interface UserCredentialsSet {
  admin: Credentials;
  portal: Credentials;
  database: Credentials;
}

export interface Credentials {
  username: string;
  password: string;
}

export interface DatabaseConfig {
  server: string;
  name: string;
  port: number;
  azureEndpoint: string;
}
