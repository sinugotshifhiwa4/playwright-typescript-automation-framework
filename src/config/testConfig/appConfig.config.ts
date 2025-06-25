import { AppConfig } from './appConfig.types';

/**
 * Application configuration settings.
 *
 * ⚠️ BEFORE RUNNING TESTS:
 * Update the following fields to match the environment and test context:
 *
 * - version: Version of the application under test
 * - platform: 'web' | 'mobile' | 'api' | 'hybrid'
 * - testType: 'unit' | 'integration' | 'e2e' | 'performance' | 'sanity' | 'regression' | 'smoke'
 */

export const appConfig: AppConfig = {
  version: '1.0.0',
  platform: 'web',
  testType: 'regression',
};
