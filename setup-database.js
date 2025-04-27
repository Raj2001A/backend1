const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Use the connection string from environment variable
const connectionString = process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL;

console.log('Using connection string:', connectionString);

// Create a new PostgreSQL connection pool optimized for setup script
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Neon PostgreSQL
  },
  // Add connection timeout
  connectionTimeoutMillis: 30000, // 30 seconds
  // Add idle timeout
  idleTimeoutMillis: 60000, // 60 seconds
  // Add max clients
  max: 5, // Fewer connections for setup script
  // Statement timeout
  statement_timeout: 60000, // 60 seconds for long-running schema creation
  // Application name for monitoring
  application_name: 'employee-management-setup'
});

async function setupDatabase() {
  const client = await pool.connect();

  try {
    console.log('Connecting to Neon PostgreSQL database...');
    console.log('Connected to Neon PostgreSQL database successfully!');

    // Check if tables already exist
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'employees'
      );
    `;

    const tableExists = await client.query(checkTableQuery);

    if (tableExists.rows[0].exists) {
      console.log('\nWARNING: Database tables already exist!');
      console.log('You have two options:');
      console.log('1. Run "npm run reset-db" to drop all existing tables and start fresh');
      console.log('2. Continue using the existing tables (your data will be preserved)\n');

      // Check if companies table has data
      const companyCountQuery = 'SELECT COUNT(*) FROM companies;';
      const companyCount = await client.query(companyCountQuery);

      console.log(`Found ${companyCount.rows[0].count} companies in the database.`);

      // Check if employees table has data
      const employeeCountQuery = 'SELECT COUNT(*) FROM employees;';
      const employeeCount = await client.query(employeeCountQuery);

      console.log(`Found ${employeeCount.rows[0].count} employees in the database.`);

      if (parseInt(companyCount.rows[0].count) === 0) {
        console.log('\nNo companies found. Inserting default companies...');

        // Insert default companies
        const insertCompaniesQuery = `
          INSERT INTO companies (name, location) VALUES
          ('CUBS TECH CONTRACTING', 'SHARJAH, UAE'),
          ('CUBS TECHNICAL SERVICES', 'ABU DHABI, UAE'),
          ('CUBS ELECTROMECHANICAL', 'SHARJAH, UAE'),
          ('CUBS FACILITIES MANAGEMENT', 'DUBAI, UAE'),
          ('CUBS TECHNICAL CONSULTANCY', 'DUBAI, UAE'),
          ('CUBS ENGINEERING', 'ABU DHABI, UAE'),
          ('CUBS CONSTRUCTION', 'DUBAI, UAE'),
          ('CUBS MAINTENANCE', 'SHARJAH, UAE'),
          ('CUBS TECHNICAL TRAINING', 'DUBAI, UAE')
          ON CONFLICT (name) DO NOTHING;
        `;

        await client.query(insertCompaniesQuery);
        console.log('Default companies inserted successfully!');
      }
    } else {
      // Read the schema SQL file
      const schemaPath = path.join(__dirname, 'database', 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      console.log('Executing schema SQL...');

      // Execute the schema SQL
      await client.query(schemaSql);

      console.log('Database schema created successfully!');
    }
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    // Release the client back to the pool
    client.release();
    // Close the pool
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the setup
setupDatabase();
