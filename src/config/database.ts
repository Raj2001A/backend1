// Database configuration
// This file provides a database interface for the application
// It uses the backend registry to manage multiple database connections

import dotenv from 'dotenv';
import { QueryResult, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { DatabaseError } from '../middleware/error';
import { backendRegistry } from '../services/backendRegistry';

// Load environment variables
dotenv.config();

// Create a mock database interface for fallback with sample data
const mockDb = {
  query: async (text: string, params?: any[]): Promise<QueryResult<any>> => {
    logger.info('Using mock database - real database connection failed', { query: text, params });
    console.log('Using mock database - real database connection failed');
    console.log('Query:', text, params ? `with params: ${JSON.stringify(params)}` : '');

    // Mock implementation with sample data
    if (text.includes('SELECT') && text.includes('employees')) {
      // Return sample employee data
      return {
        rows: [
          {
            id: '1',
            employee_id: 'EMP001',
            name: 'John Doe',
            trade: 'Engineer',
            nationality: 'USA',
            join_date: new Date('2023-01-15'),
            date_of_birth: new Date('1985-05-20'),
            mobile_number: '+1234567890',
            home_phone_number: '+1987654321',
            email: 'john.doe@example.com',
            company_id: '1',
            company_name: 'Cub Technical Services',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: '2',
            employee_id: 'EMP002',
            name: 'Jane Smith',
            trade: 'Project Manager',
            nationality: 'UK',
            join_date: new Date('2023-02-10'),
            date_of_birth: new Date('1990-08-15'),
            mobile_number: '+1234567891',
            home_phone_number: '+1987654322',
            email: 'jane.smith@example.com',
            company_id: '1',
            company_name: 'Cub Technical Services',
            created_at: new Date(),
            updated_at: new Date()
          }
        ],
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: []
      };
    } else if (text.includes('SELECT') && text.includes('companies')) {
      // Return sample company data
      return {
        rows: [
          {
            id: '1',
            name: 'Cub Technical Services',
            location: 'Dubai, UAE',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: '2',
            name: 'Cub Technical International',
            location: 'Abu Dhabi, UAE',
            created_at: new Date(),
            updated_at: new Date()
          }
        ],
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: []
      };
    }

    // Default empty response
    return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
  },
  connect: async (): Promise<PoolClient> => {
    const mockClient = {
      query: async (text: string): Promise<QueryResult<any>> => {
        // Handle different query types
        if (text.includes('SELECT') && text.includes('employees')) {
          return {
            rows: [
              {
                id: '1',
                employee_id: 'EMP001',
                name: 'John Doe',
                trade: 'Engineer',
                nationality: 'USA'
              }
            ],
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: []
          };
        }
        return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
      },
      release: () => {},
      // Add other required properties to match PoolClient interface
      on: () => mockClient,
      off: () => mockClient,
      once: () => mockClient,
      removeListener: () => mockClient,
      removeAllListeners: () => mockClient,
      listeners: () => [],
      listenerCount: () => 0,
      emit: () => false,
      eventNames: () => [],
      prependListener: () => mockClient,
      prependOnceListener: () => mockClient,
      rawCopyTo: async () => 0,
      rawCopyFrom: async () => 0,
      copyTo: async () => 0,
      copyFrom: async () => 0,
      pauseDrain: () => {},
      resumeDrain: () => {},
      escapeIdentifier: () => '',
      escapeLiteral: () => ''
    } as unknown as PoolClient;

    return mockClient;
  },
  end: async (): Promise<void> => {}
};

// Simple database interface that uses the backend registry
const db = {
  // Execute a query using the backend registry
  query: async (text: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      return await backendRegistry.query(text, params);
    } catch (error) {
      logger.error('Database query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        error: error instanceof Error ? error.message : String(error)
      });

      throw new DatabaseError(
        `Database query failed: ${error instanceof Error ? error.message : String(error)}`,
        { query: text.substring(0, 100) + (text.length > 100 ? '...' : '') }
      );
    }
  },

  // Get a client from the backend registry
  connect: async (): Promise<PoolClient> => {
    try {
      return await backendRegistry.getClient();
    } catch (error) {
      logger.error('Failed to get database client', {
        error: error instanceof Error ? error.message : String(error)
      });

      throw new DatabaseError('Failed to connect to database');
    }
  },

  // End all database connections
  end: async (): Promise<void> => {
    // This is handled by the backend registry
    return Promise.resolve();
  }
};

// Export the database interface
export default db;
