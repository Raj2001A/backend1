/**
 * Test Database Connection
 * This script tests the connection to the Neon PostgreSQL database directly
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get connection string from environment
const connectionString = process.env.NEON_DATABASE_URL;

console.log('Testing database connection...');
console.log(`Connection string: ${connectionString?.replace(/:[^:]*@/, ':****@')}`);

// Create a new pool with non-strict SSL for development
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Disable SSL validation for development
  }
});

// Test the connection
async function testConnection() {
  let client;
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('Successfully connected to database!');

    // Test a simple query
    console.log('Testing query...');
    const result = await client.query('SELECT current_timestamp as time, current_database() as database');
    console.log('Query result:', result.rows[0]);

    // Test if tables exist
    console.log('Checking for tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('No tables found in the database.');
    } else {
      console.log('Tables found:');
      tablesResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    }

    console.log('Database connection test completed successfully!');
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the test
testConnection();
