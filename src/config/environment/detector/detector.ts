import type { EnvironmentStage } from '../dotenv/types';
import { isValidEnvironmentStage } from '../dotenv/types';

export default class EnvironmentDetector {
  /**
   * Checks if running in CI environment
   */
  public static isCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.TRAVIS ||
      process.env.CIRCLECI ||
      process.env.JENKINS_URL ||
      process.env.BITBUCKET_BUILD_NUMBER
    );
  }

  /**
   * Gets current environment stage
   */
  public static getCurrentStage(): EnvironmentStage {
    const env = process.env.ENV || process.env.NODE_ENV || 'dev';
    return isValidEnvironmentStage(env) ? env : 'dev';
  }

  /**
   * Checks if current environment is development
   */
  public static isDevelopment(): boolean {
    return this.getCurrentStage() === 'dev';
  }

  /**
   * Checks if current environment is uat
   */
  public static isUat(): boolean {
    return this.getCurrentStage() === 'uat';
  }

  /**
   * Checks if current environment is production
   */
  public static isProduction(): boolean {
    return this.getCurrentStage() === 'prod';
  }

  /**
   * Checks if sharding is enabled for the current test run.
   * Sharding can be enabled either in CI or locally by setting SHARD_INDEX and SHARD_TOTAL.
   *
   * @returns {boolean} `true` if sharding is enabled, `false` otherwise
   */
  public static isShardingEnabled(): boolean {
    return !!(process.env.SHARD_INDEX && process.env.SHARD_TOTAL);
  }
}
