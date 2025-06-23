import EnvironmentDetector from '../../../config/environment/detector/detector';
import FileSystemManager from '../../fileSystem/fileSystemManager';
import { AuthStorageConstants } from '../../../config/coreTypes/auth/authStorage.constants';
import { FileEncoding } from '../../../config/coreTypes/configTypes/file-encoding.enum';
import ErrorHandler from '../../errors/errorHandler';
import logger from '../../logging/loggerManager';

export default class AuthStorageManager {
  static readonly isCI = EnvironmentDetector.isCI();
  private static hasBeenReset = false;

  /**
   * Checks if auth storage mechanism is enabled via environment variable
   */
  public static isAuthStorageEnabled(): boolean {
    const useAuthStorage = process.env.USE_AUTH_STORAGE?.toLowerCase();
    return (
      useAuthStorage === undefined ||
      useAuthStorage === 'true' ||
      useAuthStorage === '1' ||
      useAuthStorage === 'yes'
    );
  }

  /**
   * Ensures the auth state directory exists
   */
  public static async createAuthDirectoryIfNeeded(): Promise<void> {
    try {
      const directory = FileSystemManager.getDirectoryPath(AuthStorageConstants.DIRECTORY);

      // Always ensure directory exists, even in CI environment
      await FileSystemManager.createDirectory(directory);
      logger.debug(`Authentication directory created: ${directory}`);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'createAuthDirectoryIfNeeded',
        `Failed to create auth state directory`,
      );
      throw error;
    }
  }

  /**
   * Resolves the path to the authentication state file based on the environment
   * - CI mode: `.auth/ci-login.json`
   * - Local mode: `.auth/local-login.json`
   * Also ensures the directory exists and optionally resets file to empty state
   * @param shouldResetFile Whether to reset the file to an empty state (default: false)
   */
  public static async resolveAuthStateFilePath(shouldResetFile: boolean = false): Promise<string> {
    try {
      // First ensure the directory exists
      await this.createAuthDirectoryIfNeeded();

      const fileName = AuthStorageManager.isCI
        ? AuthStorageConstants.CI_AUTH_FILE
        : AuthStorageConstants.LOCAL_AUTH_FILE;
      const filePath = FileSystemManager.resolveFilePath(AuthStorageConstants.DIRECTORY, fileName);

      if (shouldResetFile) {
        await this.initializeEmptyAuthStateFile();
      }

      return filePath;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'resolveAuthStateFilePath',
        `Failed to resolve auth state file path`,
      );
      throw error;
    }
  }

  /**
   * Deletes the auth state directory
   */
  public static async deleteAuthStateDirectory(): Promise<boolean> {
    try {
      const dirPath = FileSystemManager.getDirectoryPath(AuthStorageConstants.DIRECTORY);

      const exists = await FileSystemManager.doesDirectoryExist(dirPath);

      if (exists) {
        await FileSystemManager.deleteDirectory(dirPath);
        logger.debug(`Auth state directory deleted: ${dirPath}`);
      }
      return true;
    } catch (error) {
      logger.error(`Failed to delete auth state directory: ${error}`);
      return false;
    }
  }

  /**
   * Checks if the auth state file exists
   * @param resetIfExists Whether to reset the file to empty state if it exists (default: false)
   */
  public static async doesAuthStateFileExist(resetIfExists: boolean = false): Promise<boolean> {
    try {
      // This will ensure the directory exists first
      const filePath = await this.resolveAuthStateFilePath(resetIfExists);

      const exists = await FileSystemManager.doesFileExist(filePath);

      logger.debug(`Auth state file ${exists ? 'exists' : 'does not exist'}: ${filePath}`);
      return exists;
    } catch (error) {
      logger.warn(`Error checking auth state file: ${error}`);
      return false;
    }
  }

  /**
   * Initializes the authentication state file to an empty state.
   * This method ensures the file reset happens only once per test run.
   * It creates the file with an empty JSON object if it doesn't exist,
   * or resets it if it does. The directory is created if needed.
   *
   * @returns {Promise<boolean>} true if the file was successfully initialized or had already been reset; false if an error occurred.
   */
  public static async initializeEmptyAuthStateFile(): Promise<boolean> {
    // This ensures the reset happens exactly once per test run
    if (this.hasBeenReset) {
      return true;
    }

    try {
      // Set the flag to prevent further resets
      this.hasBeenReset = true;

      // Ensure directory exists
      await this.createAuthDirectoryIfNeeded();

      // Get the file path
      const fileName = AuthStorageManager.isCI
        ? AuthStorageConstants.CI_AUTH_FILE
        : AuthStorageConstants.LOCAL_AUTH_FILE;
      const filePath = FileSystemManager.resolveFilePath(AuthStorageConstants.DIRECTORY, fileName);

      // Create or reset the file with empty JSON object
      await FileSystemManager.writeFile(
        filePath,
        JSON.stringify({}),
        'authStateFile',
        FileEncoding.UTF8,
      );
      //logger.debug(`Initialized authentication state file with empty state: ${filePath}`);

      return true;
    } catch (error) {
      logger.error(`Failed to initialize auth state file: ${error}`);
      this.hasBeenReset = false; // Reset flag so it can try again
      return false;
    }
  }
}
