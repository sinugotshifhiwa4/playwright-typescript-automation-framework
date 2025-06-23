import EnvironmentDetector from '../detector/detector';
import type { EnvironmentStage } from '../dotenv/types';

export default class EnvironmentVarsValidator {
  private static readonly currentEnvironment: EnvironmentStage =
    EnvironmentDetector.getCurrentStage();

  /**
   * Gets the required variables as an array
   */
  public static getRequiredVariablesArray(): string[] {
    return this.getRequiredVariables().split(',');
  }

  /**
   * Public method to get required variables as comma-separated string
   * This method is called by EnvironmentVariables class to set process.env.REQUIRED_ENV_VARS
   */
  public static REQUIRED_VARIABLES(): string {
    return this.getRequiredVariables();
  }

  /**
   * Returns comma-separated list of all required environment variables
   */
  private static getRequiredVariables(): string {
    const baseVariables = ['API_BASE_URL', 'PORTAL_USERNAME', 'PORTAL_PASSWORD'];

    // Add environment-specific secret key
    baseVariables.push(this.getSecretKeyVariable());

    return baseVariables.join(',');
  }

  /**
   * Gets environment-specific secret key variable name
   */
  private static getSecretKeyVariable(): string {
    switch (this.currentEnvironment) {
      case 'dev':
        return 'DEV_SECRET_KEY';
      case 'uat':
        return 'UAT_SECRET_KEY';
      case 'prod':
        return 'PROD_SECRET_KEY';
      default:
        return 'DEV_SECRET_KEY';
    }
  }
}
