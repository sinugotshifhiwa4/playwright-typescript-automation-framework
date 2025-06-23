import { Page } from '@playwright/test';
import AuthStorageManager from '../storage/authStorageManager';
import { EnvironmentResolver } from '../../../config/environment/resolver/environmentResolver';
import { LoginPage } from './../../../ui/pages/loginPage';
import ErrorHandler from '../../errors/errorHandler';
import logger from '../../logging/loggerManager';

export class BrowserSessionManager {
  private readonly page: Page;
  private readonly environmentResolver: EnvironmentResolver;
  private loginPage: LoginPage;

  constructor(page: Page, environmentResolver: EnvironmentResolver, loginPage: LoginPage) {
    this.page = page;
    this.environmentResolver = environmentResolver;
    this.loginPage = loginPage;
  }

  /**
   * Performs user login and optionally saves the authentication state
   * @param username - The username to login with
   * @param password - The password to login with
   * @param saveAuthState - Whether to save the authentication state after login (default: true)
   * @returns Promise that resolves when login is complete
   */
  public async performLogin(
    username: string,
    password: string,
    shouldSaveAuthState: boolean = true,
  ): Promise<void> {
    try {
      const resolvedUrl = await this.environmentResolver.getPortalBaseUrl();
      await this.loginPage.navigateToUrl(resolvedUrl);
      await this.loginPage.fillUsernameInput(username);
      await this.loginPage.fillPasswordInput(password);
      await this.loginPage.clickLoginButton();

      if (shouldSaveAuthState) {
        await this.page.waitForLoadState('networkidle');
        await this.saveSessionState();
      }
    } catch (error) {
      ErrorHandler.captureError(error, 'performLogin', 'Failed to perform login');
      throw error;
    }
  }

  /**
   * Saves the current browser session state to the authentication state file
   * @returns Promise that resolves when the storage state has been saved
   */
  private async saveSessionState(): Promise<void> {
    try {
      const storagePath = await AuthStorageManager.resolveAuthStateFilePath();
      await this.page.context().storageState({ path: storagePath });
      logger.info(`Successfully saved browser session state to: ${storagePath}`);
    } catch (error) {
      ErrorHandler.captureError(error, 'saveSessionState', 'Failed to save browser session state');
      throw error;
    }
  }

  /**
   * Clears the current session state by initializing an empty state file
   * @returns Promise that resolves to true if successfully cleared, false otherwise
   */
  async clearSessionState(): Promise<boolean> {
    try {
      return await AuthStorageManager.initializeEmptyAuthStateFile();
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'clearSessionState',
        'Failed to clear browser session state',
      );
      return false;
    }
  }
}
