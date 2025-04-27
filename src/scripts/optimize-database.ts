/**
 * Database Optimization Script
 * 
 * This script performs various database optimizations:
 * 1. Creates missing indexes
 * 2. Updates table statistics
 * 3. Creates materialized views for dashboard
 * 4. Sets up automatic refresh for materialized views
 * 5. Performs VACUUM ANALYZE on tables
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Get connection string from environment
const connectionString = process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL;

// Create a new pool with optimized settings for maintenance
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: process.env.NODE_ENV === 'production', // Only require SSL validation in production
  },
  connectionTimeoutMillis: 60000, // 60 seconds
  idleTimeoutMillis: 120000, // 2 minutes
  max: 3, // Limit connections for maintenance
  statement_timeout: 300000, // 5 minutes for long-running operations
  application_name: 'employee-management-optimizer'
});

// Main optimization function
async function optimizeDatabase() {
  let client;
  try {
    logger.info('Starting database optimization...');
    
    // Connect to database
    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    
    // 1. Create missing indexes
    logger.info('Creating missing indexes...');
    await createMissingIndexes(client);
    
    // 2. Update table statistics
    logger.info('Updating table statistics...');
    await updateTableStatistics(client);
    
    // 3. Create or refresh materialized views
    logger.info('Creating/refreshing materialized views...');
    await setupMaterializedViews(client);
    
    // 4. Set up automatic refresh for materialized views
    logger.info('Setting up automatic refresh for materialized views...');
    await setupAutomaticRefresh(client);
    
    // Commit transaction
    await client.query('COMMIT');
    
    // 5. Perform VACUUM ANALYZE (outside transaction)
    logger.info('Performing VACUUM ANALYZE...');
    await vacuumAnalyzeTables(client);
    
    logger.info('Database optimization completed successfully!');
  } catch (error) {
    // Rollback transaction on error
    if (client) {
      await client.query('ROLLBACK');
    }
    
    logger.error('Error optimizing database:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw error;
  } finally {
    // Release client back to pool
    if (client) {
      client.release();
    }
    
    // Close pool
    await pool.end();
  }
}

// Create missing indexes
async function createMissingIndexes(client: any) {
  // Check for missing indexes on employees table
  const employeeIndexes = [
    { name: 'idx_employees_company_id', columns: 'company_id' },
    { name: 'idx_employees_trade', columns: 'trade' },
    { name: 'idx_employees_nationality', columns: 'nationality' },
    { name: 'idx_employees_visa_expiry_date', columns: 'visa_expiry_date' },
    { name: 'idx_employees_join_date', columns: 'join_date' },
    { name: 'idx_employees_name', columns: 'name' },
    { name: 'idx_employees_email', columns: 'email' },
    { name: 'idx_employees_employee_id', columns: 'employee_id' }
  ];
  
  // Check for missing indexes on documents table
  const documentIndexes = [
    { name: 'idx_documents_employee_id', columns: 'employee_id' },
    { name: 'idx_documents_type', columns: 'type' },
    { name: 'idx_documents_expiry_date', columns: 'expiry_date' },
    { name: 'idx_documents_status', columns: 'status' },
    { name: 'idx_documents_created_at', columns: 'created_at' }
  ];
  
  // Create missing indexes
  for (const index of [...employeeIndexes, ...documentIndexes]) {
    try {
      // Check if index exists
      const indexExists = await client.query(`
        SELECT 1 FROM pg_indexes 
        WHERE indexname = $1
      `, [index.name]);
      
      if (indexExists.rowCount === 0) {
        // Create index
        const tableName = index.name.includes('employees') ? 'employees' : 'documents';
        await client.query(`
          CREATE INDEX ${index.name} ON ${tableName}(${index.columns})
        `);
        logger.info(`Created index ${index.name} on ${tableName}(${index.columns})`);
      } else {
        logger.info(`Index ${index.name} already exists, skipping`);
      }
    } catch (error) {
      logger.warn(`Error creating index ${index.name}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Create partial indexes for common queries
  try {
    // Check if partial index for active employees with visa expiry exists
    const partialIndexExists = await client.query(`
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_employees_active_visa_expiry'
    `);
    
    if (partialIndexExists.rowCount === 0) {
      // Create partial index
      await client.query(`
        CREATE INDEX idx_employees_active_visa_expiry 
        ON employees(visa_expiry_date) 
        WHERE visa_expiry_date IS NOT NULL
      `);
      logger.info('Created partial index idx_employees_active_visa_expiry');
    } else {
      logger.info('Partial index idx_employees_active_visa_expiry already exists, skipping');
    }
  } catch (error) {
    logger.warn('Error creating partial index:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Create composite indexes for common joins
  try {
    // Check if composite index for employees by company and trade exists
    const compositeIndexExists = await client.query(`
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_employees_company_trade'
    `);
    
    if (compositeIndexExists.rowCount === 0) {
      // Create composite index
      await client.query(`
        CREATE INDEX idx_employees_company_trade 
        ON employees(company_id, trade)
      `);
      logger.info('Created composite index idx_employees_company_trade');
    } else {
      logger.info('Composite index idx_employees_company_trade already exists, skipping');
    }
  } catch (error) {
    logger.warn('Error creating composite index:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Update table statistics
async function updateTableStatistics(client: any) {
  const tables = ['employees', 'documents', 'companies', 'emergency_contacts'];
  
  for (const table of tables) {
    try {
      await client.query(`ANALYZE ${table}`);
      logger.info(`Updated statistics for table ${table}`);
    } catch (error) {
      logger.warn(`Error updating statistics for table ${table}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Set up materialized views for dashboard
async function setupMaterializedViews(client: any) {
  // Check if employee stats materialized view exists
  const employeeStatsViewExists = await client.query(`
    SELECT 1 FROM pg_matviews 
    WHERE matviewname = 'dashboard_employee_stats'
  `);
  
  if (employeeStatsViewExists.rowCount === 0) {
    // Create materialized view
    await client.query(`
      CREATE MATERIALIZED VIEW dashboard_employee_stats AS
      SELECT
        COUNT(*) AS total_employees,
        COUNT(CASE WHEN visa_expiry_date IS NOT NULL AND visa_expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) AS expiring_visas_30_days,
        COUNT(CASE WHEN visa_expiry_date IS NOT NULL AND visa_expiry_date <= CURRENT_DATE + INTERVAL '14 days' THEN 1 END) AS expiring_visas_14_days,
        COUNT(CASE WHEN visa_expiry_date IS NOT NULL AND visa_expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) AS expiring_visas_7_days,
        COUNT(DISTINCT nationality) AS nationality_count,
        COUNT(DISTINCT trade) AS trade_count,
        COUNT(CASE WHEN join_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) AS new_employees_30_days
      FROM employees
    `);
    logger.info('Created materialized view dashboard_employee_stats');
  } else {
    // Refresh materialized view
    await client.query('REFRESH MATERIALIZED VIEW dashboard_employee_stats');
    logger.info('Refreshed materialized view dashboard_employee_stats');
  }
  
  // Check if nationality distribution materialized view exists
  const nationalityViewExists = await client.query(`
    SELECT 1 FROM pg_matviews 
    WHERE matviewname = 'dashboard_nationality_distribution'
  `);
  
  if (nationalityViewExists.rowCount === 0) {
    // Create materialized view
    await client.query(`
      CREATE MATERIALIZED VIEW dashboard_nationality_distribution AS
      SELECT
        nationality,
        COUNT(*) AS count
      FROM employees
      GROUP BY nationality
      ORDER BY count DESC
    `);
    logger.info('Created materialized view dashboard_nationality_distribution');
    
    // Create index on materialized view
    await client.query(`
      CREATE UNIQUE INDEX idx_dashboard_nationality_distribution 
      ON dashboard_nationality_distribution(nationality)
    `);
  } else {
    // Refresh materialized view
    await client.query('REFRESH MATERIALIZED VIEW dashboard_nationality_distribution');
    logger.info('Refreshed materialized view dashboard_nationality_distribution');
  }
  
  // Check if trade distribution materialized view exists
  const tradeViewExists = await client.query(`
    SELECT 1 FROM pg_matviews 
    WHERE matviewname = 'dashboard_trade_distribution'
  `);
  
  if (tradeViewExists.rowCount === 0) {
    // Create materialized view
    await client.query(`
      CREATE MATERIALIZED VIEW dashboard_trade_distribution AS
      SELECT
        trade,
        COUNT(*) AS count
      FROM employees
      GROUP BY trade
      ORDER BY count DESC
    `);
    logger.info('Created materialized view dashboard_trade_distribution');
    
    // Create index on materialized view
    await client.query(`
      CREATE UNIQUE INDEX idx_dashboard_trade_distribution 
      ON dashboard_trade_distribution(trade)
    `);
  } else {
    // Refresh materialized view
    await client.query('REFRESH MATERIALIZED VIEW dashboard_trade_distribution');
    logger.info('Refreshed materialized view dashboard_trade_distribution');
  }
  
  // Check if company distribution materialized view exists
  const companyViewExists = await client.query(`
    SELECT 1 FROM pg_matviews 
    WHERE matviewname = 'dashboard_company_distribution'
  `);
  
  if (companyViewExists.rowCount === 0) {
    // Create materialized view
    await client.query(`
      CREATE MATERIALIZED VIEW dashboard_company_distribution AS
      SELECT
        c.name AS company_name,
        COUNT(e.id) AS employee_count
      FROM companies c
      LEFT JOIN employees e ON c.id = e.company_id
      GROUP BY c.name
      ORDER BY employee_count DESC
    `);
    logger.info('Created materialized view dashboard_company_distribution');
    
    // Create index on materialized view
    await client.query(`
      CREATE UNIQUE INDEX idx_dashboard_company_distribution 
      ON dashboard_company_distribution(company_name)
    `);
  } else {
    // Refresh materialized view
    await client.query('REFRESH MATERIALIZED VIEW dashboard_company_distribution');
    logger.info('Refreshed materialized view dashboard_company_distribution');
  }
}

// Set up automatic refresh for materialized views
async function setupAutomaticRefresh(client: any) {
  // Check if refresh function exists
  const refreshFunctionExists = await client.query(`
    SELECT 1 FROM pg_proc 
    WHERE proname = 'refresh_dashboard_views'
  `);
  
  if (refreshFunctionExists.rowCount === 0) {
    // Create refresh function
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_dashboard_views()
      RETURNS VOID AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW dashboard_employee_stats;
        REFRESH MATERIALIZED VIEW dashboard_nationality_distribution;
        REFRESH MATERIALIZED VIEW dashboard_trade_distribution;
        REFRESH MATERIALIZED VIEW dashboard_company_distribution;
      END;
      $$ LANGUAGE 'plpgsql';
    `);
    logger.info('Created refresh_dashboard_views function');
  }
  
  // Check if trigger function exists
  const triggerFunctionExists = await client.query(`
    SELECT 1 FROM pg_proc 
    WHERE proname = 'trigger_refresh_dashboard_views'
  `);
  
  if (triggerFunctionExists.rowCount === 0) {
    // Create trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_views()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Queue a job to refresh the materialized views
        -- This is a placeholder - in a real implementation, you would use pg_notify or a similar mechanism
        -- to trigger an asynchronous refresh
        PERFORM pg_notify('refresh_dashboard_views', '');
        RETURN NULL;
      END;
      $$ LANGUAGE 'plpgsql';
    `);
    logger.info('Created trigger_refresh_dashboard_views function');
  }
  
  // Check if triggers exist
  const employeeTriggerExists = await client.query(`
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'refresh_dashboard_on_employee_change'
  `);
  
  if (employeeTriggerExists.rowCount === 0) {
    // Create trigger on employees table
    await client.query(`
      CREATE TRIGGER refresh_dashboard_on_employee_change
      AFTER INSERT OR UPDATE OR DELETE ON employees
      FOR EACH STATEMENT EXECUTE FUNCTION trigger_refresh_dashboard_views();
    `);
    logger.info('Created trigger refresh_dashboard_on_employee_change');
  }
  
  const documentTriggerExists = await client.query(`
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'refresh_dashboard_on_document_change'
  `);
  
  if (documentTriggerExists.rowCount === 0) {
    // Create trigger on documents table
    await client.query(`
      CREATE TRIGGER refresh_dashboard_on_document_change
      AFTER INSERT OR UPDATE OR DELETE ON documents
      FOR EACH STATEMENT EXECUTE FUNCTION trigger_refresh_dashboard_views();
    `);
    logger.info('Created trigger refresh_dashboard_on_document_change');
  }
}

// Perform VACUUM ANALYZE on tables
async function vacuumAnalyzeTables(client: any) {
  const tables = ['employees', 'documents', 'companies', 'emergency_contacts'];
  
  for (const table of tables) {
    try {
      // VACUUM ANALYZE requires its own transaction
      await client.query(`VACUUM ANALYZE ${table}`);
      logger.info(`Performed VACUUM ANALYZE on table ${table}`);
    } catch (error) {
      logger.warn(`Error performing VACUUM ANALYZE on table ${table}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Run the optimization
optimizeDatabase()
  .then(() => {
    console.log('Database optimization completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error optimizing database:', error);
    process.exit(1);
  });
