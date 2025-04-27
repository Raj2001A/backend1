const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Use the connection string from environment variable
const connectionString = process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL;

console.log('Using connection string:', connectionString);

// Create a new PostgreSQL connection pool
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Neon PostgreSQL
  },
  // Add connection timeout
  connectionTimeoutMillis: 10000,
  // Add idle timeout
  idleTimeoutMillis: 30000,
  // Add max clients
  max: 10
});

async function resetDatabase() {
  const client = await pool.connect();

  try {
    console.log('Connecting to Neon PostgreSQL database...');
    console.log('Connected to Neon PostgreSQL database successfully!');

    console.log('Starting database reset...');

    // Start a transaction
    await client.query('BEGIN');

    // Drop tables in the correct order (to handle foreign key constraints)
    console.log('Dropping existing tables...');

    // Drop dependent tables first
    const dropTablesQuery = `
      -- Drop tables with foreign keys first
      DROP TABLE IF EXISTS scheduled_notifications CASCADE;
      DROP TABLE IF EXISTS notification_settings CASCADE;
      DROP TABLE IF EXISTS documents CASCADE;
      DROP TABLE IF EXISTS emergency_contacts CASCADE;
      DROP TABLE IF EXISTS employees CASCADE;
      DROP TABLE IF EXISTS companies CASCADE;
      DROP TABLE IF EXISTS system_settings CASCADE;
    `;

    await client.query(dropTablesQuery);

    // Commit the transaction
    await client.query('COMMIT');

    console.log('All tables dropped successfully!');
    console.log('Database is now ready for setup. Run "npm run setup-db" to create tables.');

  } catch (error) {
    // Rollback in case of error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }

    console.error('Error resetting database:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);

    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. Please check if the database server is running and accessible.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Host not found. Please check the hostname in the connection string.');
    } else if (error.code === 'ECONNRESET') {
      console.error('Connection reset by peer. This might be due to network issues or firewall settings.');
    }
  } finally {
    // Release the client back to the pool
    client.release();
    // Close the pool
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the reset
resetDatabase();
