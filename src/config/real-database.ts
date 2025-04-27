import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { DatabaseError } from '../middleware/error';

// Load environment variables
dotenv.config();

// Database configuration
const DB_CONFIG = {
  // Get the connection string from environment variables
  connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL,
  ssl: {
    require: true,
    rejectUnauthorized: process.env.NODE_ENV === 'production', // Only require SSL validation in production
  },
  // Connection pool settings optimized for high concurrency
  connectionTimeoutMillis: 30000, // 30 seconds
  idleTimeoutMillis: 120000, // 2 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 20, // Increased pool size for 300+ concurrent users
  min: 5, // Increased minimum pool size
  allowExitOnIdle: false, // Don't exit on idle in production
  // Retry settings
  maxRetries: 5,
  retryDelay: 1000, // 1 second initial delay
  // Statement timeout (prevent long-running queries)
  statement_timeout: 30000, // 30 seconds
  // Query monitoring
  application_name: 'employee-management-app',
};

// Create a PostgreSQL connection pool with robust configuration
const pool = new Pool({
  connectionString: DB_CONFIG.connectionString,
  ssl: DB_CONFIG.ssl,
  connectionTimeoutMillis: DB_CONFIG.connectionTimeoutMillis,
  idleTimeoutMillis: DB_CONFIG.idleTimeoutMillis,
  max: DB_CONFIG.max,
  allowExitOnIdle: DB_CONFIG.allowExitOnIdle
});

// Connection status tracking
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

// Log connection status
logger.info('Initializing connection to Neon PostgreSQL database...');

// Set up event listeners for the pool
pool.on('connect', (client) => {
  isConnected = true;
  connectionAttempts = 0;
  logger.info('New client connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message, stack: err.stack });
  isConnected = false;
});

pool.on('remove', () => {
  logger.debug('Client removed from pool');
});

// Function to check database connection
export const checkDatabaseConnection = async (): Promise<boolean> => {
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('SELECT NOW()');
    isConnected = true;
    logger.info('Successfully connected to Neon PostgreSQL database');
    return true;
  } catch (error) {
    isConnected = false;
    connectionAttempts++;

    logger.error('Failed to connect to PostgreSQL database', {
      error: error instanceof Error ? error.message : String(error),
      attempt: connectionAttempts,
      maxAttempts: MAX_CONNECTION_ATTEMPTS
    });

    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      logger.error(`Failed to connect after ${MAX_CONNECTION_ATTEMPTS} attempts. Using fallback data.`);
    }

    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Function to execute a query with retries
export const executeQuery = async (query: string, params: any[] = [], retries = DB_CONFIG.maxRetries): Promise<any> => {
  try {
    return await pool.query(query, params);
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      // Calculate exponential backoff delay
      const delay = DB_CONFIG.retryDelay * Math.pow(2, DB_CONFIG.maxRetries - retries);

      logger.warn(`Database query failed, retrying in ${delay}ms...`, {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        error: error instanceof Error ? error.message : String(error),
        retriesLeft: retries
      });

      // Wait for the backoff delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry the query
      return executeQuery(query, params, retries - 1);
    }

    // If we're out of retries or it's not a retryable error, throw a DatabaseError
    throw new DatabaseError(
      `Database query failed: ${error instanceof Error ? error.message : String(error)}`,
      { query: query.substring(0, 100) + (query.length > 100 ? '...' : '') }
    );
  }
};

// Function to determine if an error is retryable
const isRetryableError = (error: any): boolean => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Connection-related errors are usually retryable
  return (
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('idle') ||
    errorMessage.includes('terminating') ||
    errorMessage.includes('unavailable') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('too many clients')
  );
};

// Log connection status
logger.info('Connecting to Neon PostgreSQL database...');

// Function to test the connection with retry logic
const testConnection = async (retries = 10, delay = 5000) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('Connected to Neon PostgreSQL database successfully!');
      return true;
    } catch (err: any) {
      lastError = err;
      console.error(`Connection attempt ${attempt}/${retries} failed:`, err?.message || 'Unknown error');

      if (attempt < retries) {
        console.log(`Waiting for Neon to wake up. Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error('Error connecting to Neon PostgreSQL database after multiple attempts:', lastError);
  console.log('Connection string format (redacted):', DB_CONFIG.connectionString?.replace(/:[^:]*@/, ':****@'));
  console.log('Make sure your Neon PostgreSQL database is running and accessible');
  console.log('Check your network connection and firewall settings');
  console.log('Possible solutions:');
  console.log('1. Check if the Neon PostgreSQL database is running');
  console.log('2. Verify the connection string in the .env file');
  console.log('3. Make sure your network allows connections to the database');
  console.log('4. Check if there are any firewall or VPN issues');
  console.log('5. Try connecting to the database using a different tool to verify credentials');

  return false;
};

// Start the connection test
testConnection();

// Add error handler
pool.on('error', (err: any) => {
  console.error('Unexpected error on idle client', err?.message || 'Unknown error');
});

// Export the pool for use in other modules
export default {
  query: (text: string, params?: any[]) => pool.query(text, params),
  connect: () => pool.connect(),
  end: () => pool.end()
};
