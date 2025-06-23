export type TestPlatform = 'web' | 'mobile' | 'api' | 'hybrid';
export type TestType =
  | 'unit'
  | 'integration'
  | 'e2e'
  | 'performance'
  | 'sanity'
  | 'regression'
  | 'smoke';

export interface AppConfig {
  version: string;
  platform: TestPlatform;
  testType: TestType;
}
