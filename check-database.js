const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a connection to the database
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to Neon PostgreSQL database');
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables in the database:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    // Check employee count
    const employeeCountResult = await client.query('SELECT COUNT(*) FROM employees');
    console.log(`Number of employees in the database: ${employeeCountResult.rows[0].count}`);
    
    // Check company count
    const companyCountResult = await client.query('SELECT COUNT(*) FROM companies');
    console.log(`Number of companies in the database: ${companyCountResult.rows[0].count}`);
    
    // Sample some employee data
    const employeeSampleResult = await client.query('SELECT * FROM employees LIMIT 5');
    console.log('Sample employee data:');
    console.log(JSON.stringify(employeeSampleResult.rows, null, 2));
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabase();
