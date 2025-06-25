import { EncryptionManager } from '../manager/encryptionManager';
import { EnvironmentSecretFileManager } from '../manager/environmentSecretFileManager';
import ErrorHandler from '../../utils/errors/errorHandler';

export class CryptoOrchestrator {
  private encryptionManager: EncryptionManager;
  private environmentSecretFileManager: EnvironmentSecretFileManager;

  constructor(
    encryptionManager: EncryptionManager,
    environmentSecretFileManager: EnvironmentSecretFileManager,
  ) {
    this.encryptionManager = encryptionManager;
    this.environmentSecretFileManager = environmentSecretFileManager;
  }

  /**
   * Generates a rotatable secret key with optional rotation settings
   */
  public async generateSecretKey(
    directory: string,
    environmentBaseFilePath: string,
    keyName: string,
    secretKey: string,
  ): Promise<void> {
    if (!secretKey) {
      ErrorHandler.logAndThrow(
        'Failed to generate secret key: Secret key cannot be null or undefined',
        'generateRotatableSecretKey',
      );
    }

    try {
      const resolvedPath = await this.encryptionManager.resolveFilePath(
        directory,
        environmentBaseFilePath,
      );

      await this.environmentSecretFileManager.storeBaseEnvironmentKey(
        resolvedPath,
        keyName,
        secretKey,
      );
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'generateSecretKey',
        `Failed to generate secret key "${keyName}"`,
      );
      throw error;
    }
  }

  /**
   * Encrypts specified environment variables using the provided secret key
   */
  public async encryptEnvironmentVariables(
    directory: string,
    envFilePath: string,
    secretKeyVariable: string,
    envVariables?: string[],
  ): Promise<void> {
    try {
      await this.encryptionManager.encryptAndUpdateEnvironmentVariables(
        directory,
        envFilePath,
        secretKeyVariable,
        envVariables,
      );
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'encryptEnvironmentVariables',
        'Failed to encrypt environment variables',
      );
      throw error;
    }
  }
}
