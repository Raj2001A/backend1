/**
 * Backend Registry Service
 * Manages multiple backend connections and provides failover capabilities
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import {
  BackendConfig,
  BackendStatus,
  BackendType,
  SelectionStrategy,
  backends as configuredBackends,
  selectionStrategy as configuredStrategy
} from '../config/backends';
import { logger } from '../utils/logger';
import { DatabaseError } from '../middleware/error';
import mockDatabase from '../config/mockDatabase';

// Backend instance with connection pool
interface BackendInstance {
  config: BackendConfig;
  pool?: Pool;
  lastUsed: Date;
  healthCheckTimer?: NodeJS.Timeout;
}

// Backend registry class
class BackendRegistry {
  private backends: Map<string, BackendInstance> = new Map();
  private currentBackendId: string | null = null;
  private selectionStrategy: SelectionStrategy;
  private roundRobinIndex: number = 0;
  private initialized: boolean = false;
  private healthCheckRunning: boolean = false;

  constructor() {
    this.selectionStrategy = configuredStrategy;
    this.initializeBackends();
  }

  // Initialize all configured backends
  private initializeBackends(): void {
    if (this.initialized) return;

    logger.info('Initializing backend registry');

    // Initialize all backends
    configuredBackends.forEach(config => {
      if (!config.enabled) {
        logger.info(`Backend ${config.name} (${config.id}) is disabled, skipping initialization`);
        return;
      }

      try {
        const backend: BackendInstance = {
          config,
          lastUsed: new Date()
        };

        // Initialize connection pool for PostgreSQL backends
        if (config.type === BackendType.POSTGRES && config.connectionString) {
          // Create SSL configuration - always disable strict validation for development
          const sslConfig = { rejectUnauthorized: false };

          // Log connection attempt with more details
          console.log(`Connecting to PostgreSQL database with SSL config:`, sslConfig);

          // Log connection attempt with connection string (masked)
          const maskedConnectionString = config.connectionString?.replace(/:[^:]*@/, ':****@');
          logger.info(`Connecting to ${config.name} (${config.id}) with connection string: ${maskedConnectionString}`);
          console.log(`Connecting to ${config.name} (${config.id}) with connection string: ${maskedConnectionString}`);

          backend.pool = new Pool({
            connectionString: config.connectionString,
            ssl: sslConfig,
            connectionTimeoutMillis: config.timeout,
            idleTimeoutMillis: 30000,
            max: 10
          });

          // Set up event listeners
          backend.pool.on('error', (err) => {
            logger.error(`Error on idle client in backend ${config.id}`, {
              error: err.message,
              backend: config.id
            });
            this.updateBackendStatus(config.id, BackendStatus.DEGRADED);
          });
        }

        // Add backend to registry
        this.backends.set(config.id, backend);
        logger.info(`Initialized backend ${config.name} (${config.id})`);

        // Schedule health check
        this.scheduleHealthCheck(config.id);
      } catch (error) {
        logger.error(`Failed to initialize backend ${config.name} (${config.id})`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Set initialized flag
    this.initialized = true;

    // Select initial backend
    this.selectBackend();

    logger.info('Backend registry initialization complete');
  }

  // Schedule health check for a backend
  private scheduleHealthCheck(backendId: string): void {
    const backend = this.backends.get(backendId);
    if (!backend) return;

    // Clear existing timer
    if (backend.healthCheckTimer) {
      clearTimeout(backend.healthCheckTimer);
    }

    // Schedule new health check
    backend.healthCheckTimer = setTimeout(() => {
      this.checkBackendHealth(backendId);
    }, backend.config.healthCheckInterval);
  }

  // Check health of a backend
  private async checkBackendHealth(backendId: string): Promise<boolean> {
    const backend = this.backends.get(backendId);
    if (!backend) return false;

    // Skip health check for mock backend
    if (backend.config.type === BackendType.MOCK) {
      backend.config.status = BackendStatus.ONLINE;
      this.scheduleHealthCheck(backendId);
      return true;
    }

    // Skip if health check is already running
    if (this.healthCheckRunning) {
      this.scheduleHealthCheck(backendId);
      return backend.config.status === BackendStatus.ONLINE;
    }

    this.healthCheckRunning = true;
    let client: PoolClient | null = null;

    try {
      logger.debug(`Checking health of backend ${backend.config.name} (${backendId})`);

      // Update last checked timestamp
      backend.config.lastChecked = new Date();

      // Check PostgreSQL backend
      if (backend.config.type === BackendType.POSTGRES && backend.pool) {
        // Set timeout for health check
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Health check timeout for backend ${backendId}`));
          }, backend.config.timeout);
        });

        // Try to connect and run a simple query
        const connectPromise = async () => {
          try {
            client = await backend.pool!.connect();

            // Check if client is valid
            if (!client) {
              throw new Error('Failed to get a valid client from the pool');
            }

            // Run a simple query to verify connection
            const result = await client.query('SELECT 1 as health_check');

            // Verify result
            if (!result || !result.rows || result.rows.length === 0) {
              throw new Error('Health check query returned invalid result');
            }

            return result.rows[0].health_check === 1;
          } catch (connectError) {
            logger.warn(`Connection error during health check for backend ${backendId}`, {
              error: connectError instanceof Error ? connectError.message : String(connectError)
            });
            throw connectError;
          }
        };

        // Race the timeout and connect promises
        try {
          const isHealthy = await Promise.race([connectPromise(), timeoutPromise]);

          if (isHealthy) {
            // Backend is healthy
            backend.config.successCount++;
            backend.config.failureCount = 0;

            // Mark as online if we've reached the recovery threshold
            if (backend.config.successCount >= backend.config.recoveryThreshold &&
                backend.config.status !== BackendStatus.ONLINE) {
              this.updateBackendStatus(backendId, BackendStatus.ONLINE);
              logger.info(`Backend ${backend.config.name} (${backendId}) is now online`);
            }

            logger.debug(`Backend ${backend.config.name} (${backendId}) health check passed`);
            return true;
          }
        } catch (raceError) {
          // Log the specific error from the race
          logger.warn(`Health check race failed for backend ${backend.config.name} (${backendId})`, {
            error: raceError instanceof Error ? raceError.message : String(raceError)
          });
          // Continue to handle failure below
        }
      }

      // If we get here, the health check failed
      this.handleHealthCheckFailure(backendId);
      return false;
    } catch (error) {
      logger.warn(`Health check failed for backend ${backend.config.name} (${backendId})`, {
        error: error instanceof Error ? error.message : String(error)
      });
      this.handleHealthCheckFailure(backendId);
      return false;
    } finally {
      // Release client if we got one
      if (client) {
        try {
          // Use type assertion to ensure TypeScript knows client has release method
          (client as PoolClient & { release: () => void }).release();
        } catch (error) {
          logger.warn(`Error releasing client for backend ${backendId}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Reset health check flag
      this.healthCheckRunning = false;

      // Schedule next health check
      this.scheduleHealthCheck(backendId);
    }
  }

  // Handle health check failure
  private handleHealthCheckFailure(backendId: string): void {
    const backend = this.backends.get(backendId);
    if (!backend) return;

    // Increment failure count
    backend.config.failureCount++;
    backend.config.successCount = 0;

    // Check if we've reached the failure threshold
    if (backend.config.failureCount >= backend.config.maxFailures &&
        backend.config.status !== BackendStatus.OFFLINE) {
      this.updateBackendStatus(backendId, BackendStatus.OFFLINE);
      logger.warn(`Backend ${backend.config.name} (${backendId}) is now offline after ${backend.config.failureCount} failures`);

      // If this was the current backend, select a new one
      if (this.currentBackendId === backendId) {
        logger.info(`Current backend ${backendId} is offline, selecting new backend`);
        this.selectBackend();
      }
    } else if (backend.config.status === BackendStatus.ONLINE) {
      // Mark as degraded if it was previously online
      this.updateBackendStatus(backendId, BackendStatus.DEGRADED);
      logger.warn(`Backend ${backend.config.name} (${backendId}) is now degraded`);
    }
  }

  // Update backend status
  private updateBackendStatus(backendId: string, status: BackendStatus): void {
    const backend = this.backends.get(backendId);
    if (!backend) return;

    const oldStatus = backend.config.status;
    backend.config.status = status;

    // Log status change
    if (oldStatus !== status) {
      logger.info(`Backend ${backend.config.name} (${backendId}) status changed from ${oldStatus} to ${status}`);
    }
  }

  // Select a backend based on the current strategy
  private selectBackend(): string | null {
    // Get all enabled backends
    const enabledBackends = Array.from(this.backends.values())
      .filter(b => b.config.enabled);

    if (enabledBackends.length === 0) {
      logger.error('No enabled backends available');
      return null;
    }

    // Log available backends for debugging
    logger.debug('Available backends for selection:', {
      count: enabledBackends.length,
      backends: enabledBackends.map(b => ({
        id: b.config.id,
        name: b.config.name,
        type: b.config.type,
        status: b.config.status,
        priority: b.config.priority
      }))
    });

    let selectedBackend: BackendInstance | null = null;

    // Select backend based on strategy
    switch (this.selectionStrategy) {
      case SelectionStrategy.PRIORITY:
        // Sort by priority (lowest number first) and status
        selectedBackend = this.selectByPriority(enabledBackends);
        break;

      case SelectionStrategy.ROUND_ROBIN:
        // Round-robin selection among online backends
        selectedBackend = this.selectByRoundRobin(enabledBackends);
        break;

      case SelectionStrategy.FAILOVER:
      default:
        // Use current backend if it's online, otherwise select by priority
        if (this.currentBackendId) {
          const currentBackend = this.backends.get(this.currentBackendId);
          if (currentBackend &&
              currentBackend.config.enabled &&
              (currentBackend.config.status === BackendStatus.ONLINE ||
               currentBackend.config.status === BackendStatus.DEGRADED)) {
            // Continue using current backend if it's online or degraded
            // This prevents excessive switching between backends
            selectedBackend = currentBackend;

            // Log that we're sticking with the current backend
            logger.debug(`Keeping current ${currentBackend.config.status} backend: ${currentBackend.config.name} (${currentBackend.config.id})`);
            break;
          }
        }
        // Fallback to priority selection
        selectedBackend = this.selectByPriority(enabledBackends);
        break;
    }

    // If we couldn't select a backend, use the mock backend only if allowed
    if (!selectedBackend && process.env.DISABLE_MOCK_FALLBACK !== 'true') {
      const mockBackendId = configuredBackends.find(b => b.type === BackendType.MOCK)?.id;
      if (mockBackendId) {
        selectedBackend = this.backends.get(mockBackendId) || null;
        logger.warn('No suitable backend found, falling back to mock backend');
      }
    }

    // Update current backend
    if (selectedBackend) {
      const newBackendId = selectedBackend.config.id;
      if (this.currentBackendId !== newBackendId) {
        logger.info(`Switching backend from ${this.currentBackendId || 'none'} to ${newBackendId}`);
        this.currentBackendId = newBackendId;
      }
      selectedBackend.lastUsed = new Date();
      return newBackendId;
    }

    logger.error('Failed to select a backend');
    return null;
  }

  // Select backend by priority
  private selectByPriority(backends: BackendInstance[]): BackendInstance | null {
    // Group backends by status for better selection
    const onlineBackends = backends.filter(b => b.config.status === BackendStatus.ONLINE);
    const degradedBackends = backends.filter(b => b.config.status === BackendStatus.DEGRADED);
    const unknownBackends = backends.filter(b => b.config.status === BackendStatus.UNKNOWN);
    const offlineBackends = backends.filter(b => b.config.status === BackendStatus.OFFLINE);

    // Log backend counts by status
    logger.debug('Backend counts by status:', {
      online: onlineBackends.length,
      degraded: degradedBackends.length,
      unknown: unknownBackends.length,
      offline: offlineBackends.length,
      total: backends.length
    });

    // First try to find the primary Neon PostgreSQL backend if it's ONLINE
    let candidate = onlineBackends
      .filter(b => b.config.id === 'primary' && b.config.type === BackendType.POSTGRES)
      .sort((a, b) => a.config.priority - b.config.priority)[0];

    // Log the candidate selection
    if (candidate) {
      logger.info(`Selected primary online backend: ${candidate.config.name} (${candidate.config.id})`);
      return candidate;
    }

    // Try any other ONLINE backend by priority
    if (onlineBackends.length > 0) {
      candidate = onlineBackends.sort((a, b) => a.config.priority - b.config.priority)[0];
      logger.info(`Selected online backend: ${candidate.config.name} (${candidate.config.id})`);
      return candidate;
    }

    // If no ONLINE backend, try primary if DEGRADED
    candidate = degradedBackends
      .filter(b => b.config.id === 'primary' && b.config.type === BackendType.POSTGRES)
      .sort((a, b) => a.config.priority - b.config.priority)[0];

    if (candidate) {
      logger.info(`Selected primary degraded backend: ${candidate.config.name} (${candidate.config.id})`);
      return candidate;
    }

    // Try any other DEGRADED backend by priority
    if (degradedBackends.length > 0) {
      candidate = degradedBackends.sort((a, b) => a.config.priority - b.config.priority)[0];
      logger.info(`Selected degraded backend: ${candidate.config.name} (${candidate.config.id})`);
      return candidate;
    }

    // If no ONLINE or DEGRADED backend, try UNKNOWN status backends
    if (unknownBackends.length > 0) {
      candidate = unknownBackends.sort((a, b) => a.config.priority - b.config.priority)[0];
      logger.info(`Selected unknown status backend: ${candidate.config.name} (${candidate.config.id})`);

      // Schedule an immediate health check for this backend
      this.checkBackendHealth(candidate.config.id);
      return candidate;
    }

    // If still no candidate, use mock backend only if allowed
    if (process.env.DISABLE_MOCK_FALLBACK !== 'true') {
      candidate = backends
        .filter(b => b.config.type === BackendType.MOCK)[0];

      if (candidate) {
        logger.info(`Selected mock backend: ${candidate.config.name} (${candidate.config.id})`);
        return candidate;
      }
    }

    // Last resort: try an OFFLINE backend with lowest priority
    // This might work if the backend has recovered but hasn't been checked yet
    if (offlineBackends.length > 0) {
      candidate = offlineBackends.sort((a, b) => a.config.priority - b.config.priority)[0];
      logger.warn(`Last resort: Selected offline backend: ${candidate.config.name} (${candidate.config.id})`);

      // Schedule an immediate health check for this backend
      this.checkBackendHealth(candidate.config.id);
      return candidate;
    }

    logger.error('No suitable backend found');
    return null;
  }

  // Select backend by round-robin
  private selectByRoundRobin(backends: BackendInstance[]): BackendInstance | null {
    // Filter to only ONLINE backends
    const onlineBackends = backends
      .filter(b => b.config.status === BackendStatus.ONLINE);

    // Log available online backends for round-robin
    logger.debug('Available online backends for round-robin:', {
      count: onlineBackends.length,
      backends: onlineBackends.map(b => ({
        id: b.config.id,
        name: b.config.name,
        type: b.config.type,
        priority: b.config.priority
      }))
    });

    if (onlineBackends.length === 0) {
      logger.info('No ONLINE backends available for round-robin, falling back to priority selection');
      // If no ONLINE backends, fall back to priority selection
      return this.selectByPriority(backends);
    }

    // Sort by priority first to ensure consistent ordering
    const sortedBackends = [...onlineBackends].sort((a, b) => a.config.priority - b.config.priority);

    // Increment round-robin index
    this.roundRobinIndex = (this.roundRobinIndex + 1) % sortedBackends.length;
    const selected = sortedBackends[this.roundRobinIndex];

    logger.info(`Round-robin selected backend: ${selected.config.name} (${selected.config.id}) [${this.roundRobinIndex + 1}/${sortedBackends.length}]`);
    return selected;
  }

  // Execute a query on the current backend with retry logic
  public async query(text: string, params?: any[], retryCount: number = 0): Promise<QueryResult<any>> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 500; // Start with 500ms delay

    // Make sure we have a current backend
    if (!this.currentBackendId) {
      this.selectBackend();
    }

    // If still no backend, throw error
    if (!this.currentBackendId) {
      throw new DatabaseError('No backend available for query');
    }

    const backend = this.backends.get(this.currentBackendId);
    if (!backend) {
      throw new DatabaseError(`Selected backend ${this.currentBackendId} not found`);
    }

    try {
      // Update last used timestamp
      backend.lastUsed = new Date();

      // Execute query based on backend type
      if (backend.config.type === BackendType.POSTGRES && backend.pool) {
        // Set a timeout for the query
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Query timeout after ${backend.config.timeout}ms`));
          }, backend.config.timeout);
        });

        // Log the query being executed
        console.log(`Executing query on ${backend.config.name} (${backend.config.id}):`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        if (params) {
          console.log('Query parameters:', params);
        }

        // Execute the query
        const queryPromise = backend.pool.query(text, params);

        // Race the timeout and query promises
        return await Promise.race([queryPromise, timeoutPromise]);
      } else if (backend.config.type === BackendType.MOCK) {
        return await mockDatabase.query(text, params);
      } else {
        throw new DatabaseError(`Unsupported backend type: ${backend.config.type}`);
      }
    } catch (error) {
      // Log the error
      logger.error(`Query failed on backend ${backend.config.name} (${backend.config.id})`, {
        error: error instanceof Error ? error.message : String(error),
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        retryCount
      });

      // Mark backend as degraded
      this.updateBackendStatus(backend.config.id, BackendStatus.DEGRADED);

      // Schedule an immediate health check
      this.checkBackendHealth(backend.config.id);

      // Check if we should retry with the same backend
      const isTransientError = this.isTransientError(error);
      if (isTransientError && retryCount < MAX_RETRIES) {
        // Calculate exponential backoff delay
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);

        logger.info(`Retrying query on same backend after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        // Wait for the delay
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the query with incremented retry count
        return this.query(text, params, retryCount + 1);
      }

      // Try to select a new backend
      const newBackendId = this.selectBackend();

      // If we got a new backend, try the query again
      if (newBackendId && newBackendId !== backend.config.id) {
        logger.info(`Retrying query on new backend ${newBackendId}`);
        return this.query(text, params, 0); // Reset retry count for new backend
      }

      // If we've exhausted all retries and backends, check if we can use mock data
      if (backend.config.type !== BackendType.MOCK && process.env.DISABLE_MOCK_FALLBACK !== 'true') {
        const mockBackendId = configuredBackends.find(b => b.type === BackendType.MOCK)?.id;
        if (mockBackendId) {
          const mockBackend = this.backends.get(mockBackendId);
          if (mockBackend && mockBackend.config.enabled) {
            logger.warn('Falling back to mock database after all retries failed');
            this.currentBackendId = mockBackendId;
            return mockDatabase.query(text, params);
          }
        }
      }

      // If we couldn't select a new backend or use mock data, throw a more descriptive error
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(
        `Database query failed after ${retryCount} retries: ${errorMessage}`,
        { query: text.substring(0, 100) + (text.length > 100 ? '...' : ''), params }
      );
    }
  }

  // Helper method to determine if an error is transient and should be retried
  private isTransientError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any).code;
    const lowerErrorMessage = errorMessage.toLowerCase();

    // Check for common transient error patterns
    const transientErrorCodes = [
      // Connection-related error codes
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
      '08007', // transaction_resolution_unknown
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03', // cannot_connect_now
      '53300', // too_many_connections
      '53400', // configuration_limit_exceeded

      // Lock-related error codes
      '55P03', // lock_not_available
      '55006', // object_in_use
      '40001', // serialization_failure
      '40P01', // deadlock_detected

      // Resource-related error codes
      '53000', // insufficient_resources
      '53100', // disk_full
      '53200', // out_of_memory
      '54000', // program_limit_exceeded

      // Neon-specific error codes
      'P0001', // raise_exception (often used for custom errors)
      'XX000', // internal_error
      'XX001'  // data_corrupted
    ];

    // Common transient error message patterns
    const transientPatterns = [
      // Connection issues
      'connection', 'timeout', 'temporarily unavailable', 'too many connections',
      'connection reset', 'econnrefused', 'etimedout', 'connection terminated',
      'connection refused', 'connection closed', 'no connection',

      // Network issues
      'network', 'unreachable', 'ehostunreach', 'enetunreach', 'network error',
      'network timeout', 'network unreachable', 'network connection',

      // Database load issues
      'too many clients', 'max_connections', 'connection limit', 'server overloaded',
      'database is starting up', 'database is shutting down',

      // Temporary failures
      'try again', 'retry', 'temporarily', 'overloaded', 'temporary failure',
      'resource temporarily unavailable', 'service unavailable',

      // Neon-specific errors
      'compute node is starting', 'compute node is restarting',
      'compute node is scaling', 'connection pool is full',
      'database is currently not accepting connections',
      'the database system is starting up',
      'the database system is shutting down'
    ];

    // Check for timeout or connection errors
    const isTimeout = lowerErrorMessage.includes('timeout');
    const isConnectionError = transientPatterns.some(pattern =>
      lowerErrorMessage.includes(pattern)
    );
    const isDeadlockOrLockError = lowerErrorMessage.includes('deadlock') ||
                                 lowerErrorMessage.includes('lock');
    const hasTransientErrorCode = errorCode && transientErrorCodes.includes(errorCode);

    // Log detailed information about the error for debugging
    if (isTimeout || isConnectionError || isDeadlockOrLockError || hasTransientErrorCode) {
      logger.debug('Detected transient error', {
        errorMessage,
        errorCode,
        isTimeout,
        isConnectionError,
        isDeadlockOrLockError,
        hasTransientErrorCode
      });
    }

    return isTimeout ||
           isConnectionError ||
           isDeadlockOrLockError ||
           hasTransientErrorCode;
  }

  // Get a client from the current backend with retry logic
  public async getClient(retryCount: number = 0): Promise<PoolClient> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 500; // Start with 500ms delay

    // Make sure we have a current backend
    if (!this.currentBackendId) {
      this.selectBackend();
    }

    // If still no backend, throw error
    if (!this.currentBackendId) {
      throw new DatabaseError('No backend available for client');
    }

    const backend = this.backends.get(this.currentBackendId);
    if (!backend) {
      throw new DatabaseError(`Selected backend ${this.currentBackendId} not found`);
    }

    try {
      // Update last used timestamp
      backend.lastUsed = new Date();

      // Get client based on backend type
      if (backend.config.type === BackendType.POSTGRES && backend.pool) {
        // Set a timeout for the connection
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Client connection timeout after ${backend.config.timeout}ms`));
          }, backend.config.timeout);
        });

        // Get a client from the pool
        const connectPromise = backend.pool.connect();

        // Race the timeout and connect promises
        const client = await Promise.race([connectPromise, timeoutPromise]);

        // Verify client is valid
        if (!client) {
          throw new Error('Received null client from connection pool');
        }

        return client;
      } else if (backend.config.type === BackendType.MOCK) {
        return await mockDatabase.connect();
      } else {
        throw new DatabaseError(`Unsupported backend type: ${backend.config.type}`);
      }
    } catch (error) {
      // Log the error
      logger.error(`Failed to get client from backend ${backend.config.name} (${backend.config.id})`, {
        error: error instanceof Error ? error.message : String(error),
        retryCount
      });

      // Mark backend as degraded
      this.updateBackendStatus(backend.config.id, BackendStatus.DEGRADED);

      // Schedule an immediate health check
      this.checkBackendHealth(backend.config.id);

      // Check if we should retry with the same backend
      const isTransientError = this.isTransientError(error);
      if (isTransientError && retryCount < MAX_RETRIES) {
        // Calculate exponential backoff delay
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);

        logger.info(`Retrying getClient on same backend after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        // Wait for the delay
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry getting a client with incremented retry count
        return this.getClient(retryCount + 1);
      }

      // Try to select a new backend
      const newBackendId = this.selectBackend();

      // If we got a new backend, try to get a client again
      if (newBackendId && newBackendId !== backend.config.id) {
        logger.info(`Retrying getClient on new backend ${newBackendId}`);
        return this.getClient(0); // Reset retry count for new backend
      }

      // If we've exhausted all retries and backends, check if we can use mock data
      if (backend.config.type !== BackendType.MOCK && process.env.DISABLE_MOCK_FALLBACK !== 'true') {
        const mockBackendId = configuredBackends.find(b => b.type === BackendType.MOCK)?.id;
        if (mockBackendId) {
          const mockBackend = this.backends.get(mockBackendId);
          if (mockBackend && mockBackend.config.enabled) {
            logger.warn('Falling back to mock database client after all retries failed');
            this.currentBackendId = mockBackendId;
            return mockDatabase.connect();
          }
        }
      }

      // If we couldn't select a new backend or use mock data, throw a more descriptive error
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(
        `Failed to get database client after ${retryCount} retries: ${errorMessage}`
      );
    }
  }

  // Get status of all backends
  public getStatus(): {
    currentBackend: string | null;
    strategy: SelectionStrategy;
    backends: {
      id: string;
      name: string;
      type: BackendType;
      status: BackendStatus;
      priority: number;
      lastChecked?: Date;
      lastUsed?: Date;
      enabled: boolean;
    }[]
  } {
    return {
      currentBackend: this.currentBackendId,
      strategy: this.selectionStrategy,
      backends: Array.from(this.backends.values()).map(b => ({
        id: b.config.id,
        name: b.config.name,
        type: b.config.type,
        status: b.config.status,
        priority: b.config.priority,
        lastChecked: b.config.lastChecked,
        lastUsed: b.lastUsed,
        enabled: b.config.enabled
      }))
    };
  }

  // Force switch to a specific backend
  public async switchBackend(backendId: string): Promise<boolean> {
    const backend = this.backends.get(backendId);
    if (!backend) {
      logger.error(`Cannot switch to backend ${backendId}: not found`);
      return false;
    }

    if (!backend.config.enabled) {
      logger.error(`Cannot switch to backend ${backendId}: disabled`);
      return false;
    }

    // Check health before switching
    const isHealthy = await this.checkBackendHealth(backendId);
    if (!isHealthy && backend.config.type !== BackendType.MOCK) {
      logger.error(`Cannot switch to backend ${backendId}: health check failed`);
      return false;
    }

    // Switch to the new backend
    this.currentBackendId = backendId;
    backend.lastUsed = new Date();
    logger.info(`Manually switched to backend ${backend.config.name} (${backendId})`);
    return true;
  }

  // Set selection strategy
  public setSelectionStrategy(strategy: SelectionStrategy): void {
    this.selectionStrategy = strategy;
    logger.info(`Backend selection strategy changed to ${strategy}`);

    // Re-select backend with new strategy
    this.selectBackend();
  }

  // Enable or disable a backend
  public setBackendEnabled(backendId: string, enabled: boolean): boolean {
    const backend = this.backends.get(backendId);
    if (!backend) {
      logger.error(`Cannot ${enabled ? 'enable' : 'disable'} backend ${backendId}: not found`);
      return false;
    }

    backend.config.enabled = enabled;
    logger.info(`Backend ${backend.config.name} (${backendId}) ${enabled ? 'enabled' : 'disabled'}`);

    // If we disabled the current backend, select a new one
    if (!enabled && this.currentBackendId === backendId) {
      logger.info(`Current backend ${backendId} was disabled, selecting new backend`);
      this.selectBackend();
    }

    return true;
  }

  // Check all backends health
  public async checkAllBackends(): Promise<void> {
    for (const [backendId] of this.backends) {
      await this.checkBackendHealth(backendId);
    }
  }

  // Clean up resources
  public async close(): Promise<void> {
    logger.info('Closing backend registry');

    // Close all connection pools
    for (const [id, backend] of this.backends.entries()) {
      try {
        // Clear health check timer
        if (backend.healthCheckTimer) {
          clearTimeout(backend.healthCheckTimer);
        }

        // Close pool if it exists
        if (backend.pool) {
          await backend.pool.end();
          logger.info(`Closed connection pool for backend ${id}`);
        }
      } catch (error) {
        logger.error(`Error closing backend ${id}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Clear backends map
    this.backends.clear();
    this.currentBackendId = null;
    this.initialized = false;

    logger.info('Backend registry closed');
  }
}

// Create and export singleton instance
export const backendRegistry = new BackendRegistry();
