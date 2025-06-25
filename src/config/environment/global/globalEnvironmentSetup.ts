import EnvironmentConfigLoader from '../../../utils/environment/environmentConfigManager';
import { EnvironmentSecretFileManager } from '../../../cryptography/manager/environmentSecretFileManager';
import AuthStorageManager from '../../../utils/auth/storage/authStorageManager';
import ErrorHandler from '../../../utils/errors/errorHandler';

async function initializeEnvironment(): Promise<void> {
  try {
    // Initialize the environment secret file manager
    const environmentSecretFileManager = new EnvironmentSecretFileManager();

    // Initialize the environment config loader
    const environmentConfigLoader = new EnvironmentConfigLoader(environmentSecretFileManager);
    await environmentConfigLoader.initialize();
  } catch (error) {
    ErrorHandler.captureError(error, 'initializeEnvironment', 'Environment initialization failed');
    throw error;
  }
}

async function clearAuthState(): Promise<void> {
  try {
    await AuthStorageManager.initializeEmptyAuthStateFile();
  } catch (error) {
    ErrorHandler.captureError(error, 'clearAuthState', 'Failed to clear auth state');
    throw error;
  }
}

async function globalSetup(): Promise<void> {
  try {
    await initializeEnvironment();
    await clearAuthState();
  } catch (error) {
    ErrorHandler.captureError(error, 'globalSetup', 'Global setup failed');
    throw error;
  }
}

export default globalSetup;
