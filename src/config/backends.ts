/**
 * Backend configuration for multiple database connections
 * This allows the application to connect to multiple databases and switch between them
 */

import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Backend types
export enum BackendType {
  POSTGRES = 'postgres',
  MOCK = 'mock',
  FALLBACK = 'fallback'
}

// Backend status
export enum BackendStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
  UNKNOWN = 'unknown'
}

// Backend selection strategy
export enum SelectionStrategy {
  PRIORITY = 'priority', // Use backends in order of priority
  ROUND_ROBIN = 'round-robin', // Distribute load across all available backends
  FAILOVER = 'failover' // Use primary backend until it fails, then switch to backup
}

// Backend configuration interface
export interface BackendConfig {
  id: string;
  name: string;
  type: BackendType;
  connectionString?: string;
  priority: number; // Lower number = higher priority
  status: BackendStatus;
  lastChecked?: Date;
  failureCount: number;
  maxFailures: number; // Number of failures before marking as offline
  recoveryThreshold: number; // Number of successful health checks before marking as online
  successCount: number;
  healthCheckInterval: number; // In milliseconds
  timeout: number; // In milliseconds
  enabled: boolean;
}

// Default backend configurations
const defaultBackends: BackendConfig[] = [
  {
    id: 'primary',
    name: 'Primary Neon PostgreSQL',
    type: BackendType.POSTGRES,
    connectionString: process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL,
    priority: 1,
    status: BackendStatus.UNKNOWN,
    failureCount: 0,
    maxFailures: 3,
    recoveryThreshold: 2,
    successCount: 0,
    healthCheckInterval: 30000, // 30 seconds
    timeout: 10000, // 10 seconds
    enabled: true
  },
  {
    id: 'backup',
    name: 'Backup PostgreSQL',
    type: BackendType.POSTGRES,
    connectionString: process.env.BACKUP_DATABASE_URL,
    priority: 2,
    status: BackendStatus.UNKNOWN,
    failureCount: 0,
    maxFailures: 3,
    recoveryThreshold: 2,
    successCount: 0,
    healthCheckInterval: 60000, // 60 seconds
    timeout: 10000, // 10 seconds
    enabled: process.env.BACKUP_DATABASE_URL ? true : false
  },
  {
    id: 'mock',
    name: 'Mock Database',
    type: BackendType.MOCK,
    priority: 999, // Lowest priority
    status: BackendStatus.ONLINE, // Mock is always online
    failureCount: 0,
    maxFailures: 999, // Mock never fails
    recoveryThreshold: 1,
    successCount: 999,
    healthCheckInterval: 300000, // 5 minutes
    timeout: 1000, // 1 second
    enabled: process.env.DISABLE_MOCK_FALLBACK !== 'true' // Disable if configured
  }
];

// Get backends from environment or use defaults
export const getBackendConfigs = (): BackendConfig[] => {
  try {
    // Try to get backends from environment
    const backendsEnv = process.env.BACKEND_CONFIGS;
    if (backendsEnv) {
      try {
        const parsedBackends = JSON.parse(backendsEnv);
        if (Array.isArray(parsedBackends) && parsedBackends.length > 0) {
          logger.info(`Loaded ${parsedBackends.length} backend configurations from environment`);
          return parsedBackends;
        }
      } catch (error) {
        logger.error('Failed to parse backend configurations from environment', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Use default backends
    logger.info(`Using ${defaultBackends.length} default backend configurations`);
    return defaultBackends;
  } catch (error) {
    logger.error('Error getting backend configurations', {
      error: error instanceof Error ? error.message : String(error)
    });
    return defaultBackends;
  }
};

// Get current selection strategy
export const getSelectionStrategy = (): SelectionStrategy => {
  const strategy = process.env.BACKEND_SELECTION_STRATEGY as SelectionStrategy;
  if (Object.values(SelectionStrategy).includes(strategy)) {
    return strategy;
  }
  return SelectionStrategy.PRIORITY; // Default strategy
};

// Export default backends and strategy
export const backends = getBackendConfigs();
export const selectionStrategy = getSelectionStrategy();

// Log backend configurations
logger.info(`Backend selection strategy: ${selectionStrategy}`);
logger.info(`Configured backends: ${backends.length}`);
backends.forEach(backend => {
  logger.info(`Backend: ${backend.name} (${backend.id}), Type: ${backend.type}, Priority: ${backend.priority}, Enabled: ${backend.enabled}`);
});
