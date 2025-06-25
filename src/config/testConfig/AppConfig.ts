import { appConfig } from './appConfig.config';
import { TestPlatform, TestType } from './appConfig.types';

export default class AppConfig {
  // Private constructor to prevent direct instantiation
  private constructor() {}

  public static getVersion(): string {
    return appConfig.version;
  }

  public static getPlatform(): TestPlatform {
    return appConfig.platform;
  }

  public static getTestType(): TestType {
    return appConfig.testType;
  }
}
