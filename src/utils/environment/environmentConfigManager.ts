import dotenv from 'dotenv';
import path from 'path';
import { EnvironmentSecretFileManager } from '../../cryptography/manager/environmentSecretFileManager';
import EnvironmentDetector from '../../config/environment/detector/detector';
import {
  EnvironmentStage,
  isValidEnvironmentStage,
  ENVIRONMENT_STAGES,
} from '../../config/environment/dotenv/types';
import { EnvironmentFilePaths } from '../../config/environment/dotenv/mapping';
import ErrorHandler from '../errors/errorHandler';
import logger from '../logging/loggerManager';

/**
 * State snapshot for rollback operations
 */
interface EnvironmentState {
  initialized: boolean;
  loadedFiles: string[];
  activeEnvironment: EnvironmentStage | null;
}

/**
 * Responsible for loading and managing environment configuration files
 * Handles initialization of environment variables from appropriate .env files
 */
export default class EnvironmentConfigManager {
  private environmentSecretFileManager: EnvironmentSecretFileManager;

  // Instance state tracking
  public initialized = false;
  private _loadedFiles: string[] = [];
  public activeEnvironment: EnvironmentStage | null = null;

  constructor(environmentSecretFileManager: EnvironmentSecretFileManager) {
    this.environmentSecretFileManager = environmentSecretFileManager;
  }

  /**
   * Gets a readonly copy of loaded files
   */
  public get loadedFiles(): readonly string[] {
    return Object.freeze([...this._loadedFiles]);
  }

  /**
   * Initializes the environment configuration.
   * Loads environment variables from appropriate files based on current environment.
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  public async initialize(): Promise<void> {
    // Skip if already initialized
    if (this.initialized) {
      logger.info('Environment already initialized, skipping');
      return;
    }

    try {
      // Skip local file loading in CI environments
      if (EnvironmentDetector.isCI()) {
        logger.info('CI environment detected. Skipping local environment file loading.');
        this.activeEnvironment = EnvironmentDetector.getCurrentStage();
        this.initialized = true;
        return;
      }

      // Setup environment using the helper method
      await this.setupEnvironment();
      this.activeEnvironment = EnvironmentDetector.getCurrentStage();
      this.initialized = true;

      // Log success only if we loaded at least one file
      if (this._loadedFiles.length > 0) {
        logger.info(
          `Environment successfully initialized with ${this._loadedFiles.length} config files: ${this._loadedFiles.join(', ')}`,
        );
      } else {
        logger.warn('Environment initialized but no config files were loaded');
      }
    } catch (error) {
      this.resetState();
      ErrorHandler.captureError(error, 'initialize', 'Failed to set up environment variables');
      throw error;
    }
  }

  /**
   * Reloads environment configuration with rollback capability
   * @returns Promise that resolves when reload is complete
   * @throws Error if reload fails (state will be restored to previous state)
   */
  public async reload(): Promise<void> {
    // Capture current state for potential rollback
    const previousState = this.captureState();

    try {
      logger.debug('Reloading environment configuration...');

      // Reset state before reloading
      this.resetState();

      // Reinitialize
      await this.initialize();

      logger.info(
        `Environment configuration reloaded: ${previousState.activeEnvironment} -> ${this.activeEnvironment}, ` +
          `files: [${previousState.loadedFiles.join(', ')}] -> [${this._loadedFiles.join(', ')}]`,
      );
    } catch (error) {
      // Rollback to previous state on failure
      this.restoreState(previousState);
      ErrorHandler.captureError(error, 'reload', 'Failed to reload environment configuration');
      throw error;
    }
  }

  /**
   * Gets the currently active environment
   * @returns Current environment stage or null if not initialized
   */
  public getActiveEnvironment(): EnvironmentStage | null {
    return this.activeEnvironment;
  }

  /**
   * Gets the list of environment files that were successfully loaded
   * @returns Readonly array of loaded file names
   */
  public getLoadedFiles(): readonly string[] {
    return this.loadedFiles;
  }

  /**
   * Check if the environment manager has been initialized
   * @returns True if initialized, false otherwise
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Helper method to setup the environment configuration
   * Handles loading base environment file and environment-specific files
   */
  private async setupEnvironment(): Promise<void> {
    // Load base environment file
    await this.loadBaseEnvironment();

    // Determine and load environment-specific configuration
    await this.loadEnvironmentSpecificConfig();

    // Validate required variables if specified
    this.validateRequiredVariablesIfSpecified();
  }

  /**
   * Loads the base environment file
   */
  private async loadBaseEnvironment(): Promise<void> {
    const baseEnvFilePath = await this.environmentSecretFileManager.getBaseEnvironmentFilePath();
    await this.loadBaseEnvironmentFile(baseEnvFilePath);
  }

  /**
   * Loads environment-specific configuration
   */
  private async loadEnvironmentSpecificConfig(): Promise<void> {
    const env = this.resolveAndValidateEnvironment();
    const envSpecificFilePath = EnvironmentFilePaths[env];
    await this.loadEnvironmentFileForStage(envSpecificFilePath, env);
  }

  /**
   * Validates required environment variables if REQUIRED_ENV_VARS is set
   */
  private validateRequiredVariablesIfSpecified(): void {
    const requiredVarsString = process.env.REQUIRED_ENV_VARS;
    if (requiredVarsString) {
      const requiredVars = requiredVarsString.split(',').map((v) => v.trim());
      this.validateRequiredEnvironmentVariables(requiredVars);
    }
  }

  /**
   * Loads and processes the base environment file
   * @param baseEnvFilePath Path to the base environment file
   * @throws Error if loading fails and the base file is required
   */
  private async loadBaseEnvironmentFile(baseEnvFilePath: string): Promise<void> {
    try {
      const baseEnvExists =
        await this.environmentSecretFileManager.doesBaseEnvFileExist(baseEnvFilePath);

      if (baseEnvExists) {
        this.applyEnvironmentVariablesFromFile(baseEnvFilePath);
        const baseName = path.basename(baseEnvFilePath);
        this._loadedFiles.push(baseName);
        logger.info(`Successfully loaded base environment file: ${baseName}`);
      } else {
        await this.environmentSecretFileManager.handleMissingBaseEnvFile(baseEnvFilePath);
      }
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'loadBaseEnvironmentFile',
        `Failed to load base environment file at ${baseEnvFilePath}`,
      );
      throw error;
    }
  }

  /**
   * Resolves and validates the active environment from ENV variable
   * @returns The resolved and validated environment stage
   * @throws Error if environment is invalid
   */
  private resolveAndValidateEnvironment(): EnvironmentStage {
    try {
      const env = EnvironmentDetector.getCurrentStage();

      // Additional validation since EnvironmentDetector provides fallback
      if (!isValidEnvironmentStage(env)) {
        const validEnvironments = ENVIRONMENT_STAGES.join(', ');
        const errorMsg = `Invalid environment '${env}'. Expected one of: ${validEnvironments}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      logger.debug(`Environment validated: '${env}'`);
      return env as EnvironmentStage;
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'resolveAndValidateEnvironment',
        'Failed to resolve and validate active environment',
      );
      throw error;
    }
  }

  /**
   * Tries to load an environment file for the specified stage
   * @param fileName Name of the environment file
   * @param envName Name of the environment stage
   * @returns Promise resolving to true if file was loaded, false if file doesn't exist
   * @throws Error if file exists but loading fails
   */
  private async loadEnvironmentFileForStage(fileName: string, envName: string): Promise<boolean> {
    try {
      const filePath = this.environmentSecretFileManager.resolveEnvironmentFilePath(fileName);
      const fileExists = await this.environmentSecretFileManager.doesEnvironmentFileExist(fileName);

      if (fileExists) {
        const baseName = path.basename(filePath);
        this.applyEnvironmentVariablesFromFile(filePath);
        this._loadedFiles.push(baseName);
        logger.info(`Successfully loaded variables from environment file: ${baseName}`);
        return true;
      } else {
        this.environmentSecretFileManager.logEnvironmentFileNotFound(fileName, filePath, envName);
        return false;
      }
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'loadEnvironmentFileForStage',
        `Failed to load environment file '${fileName}' for ${envName} environment`,
      );
      throw error;
    }
  }

  /**
   * Loads environment variables from the specified file path using the dotenv library.
   * @param filePath Path to the environment file
   * @throws Error if loading fails
   */
  private applyEnvironmentVariablesFromFile(filePath: string): void {
    try {
      const result = dotenv.config({ path: filePath, override: true });

      if (result.error) {
        throw new Error(
          `Error loading environment variables from ${filePath}: ${result.error.message}`,
        );
      }
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'applyEnvironmentVariablesFromFile',
        `Failed to apply environment variables from file: ${filePath}`,
      );
      throw error;
    }
  }

  /**
   * Validates that all required environment variables are present.
   * @param requiredVars Array of environment variable names that are required
   * @throws Error if any required variable is missing
   */
  public validateRequiredEnvironmentVariables(requiredVars: string[]): void {
    try {
      const missing = requiredVars.filter((varName) => process.env[varName] === undefined);
      if (missing.length > 0) {
        const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      logger.info(`All ${requiredVars.length} required environment variables are present`);
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'validateRequiredEnvironmentVariables',
        'Failed to validate required environment variables',
      );
      throw error;
    }
  }

  /**
   * Captures current state for rollback operations
   * @returns Current state snapshot
   */
  private captureState(): EnvironmentState {
    return {
      initialized: this.initialized,
      loadedFiles: [...this._loadedFiles],
      activeEnvironment: this.activeEnvironment,
    };
  }

  /**
   * Restores state from a snapshot
   * @param state State snapshot to restore
   */
  private restoreState(state: EnvironmentState): void {
    this.initialized = state.initialized;
    this._loadedFiles = [...state.loadedFiles];
    this.activeEnvironment = state.activeEnvironment;
    logger.debug('Environment state restored after failed operation');
  }

  /**
   * Resets the manager state
   */
  private resetState(): void {
    this.initialized = false;
    this._loadedFiles = [];
    this.activeEnvironment = null;
  }
}
