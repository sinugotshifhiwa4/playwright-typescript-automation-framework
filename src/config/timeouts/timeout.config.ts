// src/config/timeouts.ts
import EnvironmentDetector from '../environment/detector/detector';

// Check if running in CI environment
const isCI = EnvironmentDetector.isCI();

// Base timeout multiplier for CI environments
const CI_MULTIPLIER = 2;

// Calculate timeout based on environment
const timeout = (base: number): number => (isCI ? base * CI_MULTIPLIER : base);

export const TIMEOUTS = {
  // Test framework timeouts
  test: timeout(20_000),
  expect: timeout(60_000),
  action: timeout(45_000),
  customLongRunning: timeout(120_000),

  api: {
    standard: timeout(15_000),
    upload: timeout(60_000),
    download: timeout(90_000),
    healthCheck: timeout(3_000),
    connection: timeout(8_000),
    retry: timeout(5_000),
  },

  db: {
    query: timeout(15_000),
    transaction: timeout(30_000),
    migration: timeout(90_000),
    connection: timeout(10_000),
    poolAcquisition: timeout(10_000),
    idle: timeout(10_000),
  },
} as const;

// Export individual timeout categories for convenience
export const { test: TEST_TIMEOUT, expect: EXPECT_TIMEOUT } = TIMEOUTS;

// Utility function to get timeout with custom multiplier
export const getTimeoutWithMultiplier = (
  baseTimeout: number,
  multiplier: number = isCI ? CI_MULTIPLIER : 1,
): number => baseTimeout * multiplier;
