import { TestInfo } from '@playwright/test';
import ErrorHandler from '../errors/errorHandler';

export default class AuthenticationFilter {
  /**
   * Determines if authentication setup should be skipped for a test
   * based on test metadata and test title patterns
   *
   * @param testInfo - The TestInfo object from Playwright
   * @param additionalSkipConditions - Additional test title patterns that should skip auth
   * @returns boolean - true if auth setup should be skipped
   */
  public static shouldSkipAuthSetup(
    testInfo: TestInfo,
    additionalSkipConditions: string[] = [],
  ): boolean {
    try {
      const defaultSkipConditions = ['Authenticate'];
      const allSkipConditions = [...defaultSkipConditions, ...additionalSkipConditions];

      const skipAuth =
        testInfo.annotations.find((a) => a.type === 'skipAuth')?.description === 'true';

      // Check if the test title contains any of the skip conditions
      const titleContainsSkipCondition = allSkipConditions.some((condition) =>
        testInfo.title.toLowerCase().includes(condition.toLowerCase()),
      );

      return skipAuth || titleContainsSkipCondition;
    } catch (error) {
      ErrorHandler.captureError(error, 'shouldSkipAuthSetup', 'Failed to check auth setup');
      return false;
    }
  }
}
