const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connection string
const connectionString = process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL;

console.log('Attempting to connect to:', connectionString);

// Create a client instance
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkDatabase() {
  try {
    // Connect to the database
    await client.connect();
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
    
    // Check if employees table exists
    const employeeTableExists = tablesResult.rows.some(row => row.table_name === 'employees');
    
    if (employeeTableExists) {
      // Check employee count
      const employeeCountResult = await client.query('SELECT COUNT(*) FROM employees');
      console.log(`Number of employees in the database: ${employeeCountResult.rows[0].count}`);
      
      // Sample some employee data
      if (parseInt(employeeCountResult.rows[0].count) > 0) {
        const employeeSampleResult = await client.query('SELECT * FROM employees LIMIT 5');
        console.log('Sample employee data:');
        console.log(JSON.stringify(employeeSampleResult.rows, null, 2));
      }
    } else {
      console.log('Employees table does not exist in the database');
    }
    
    // Check if companies table exists
    const companyTableExists = tablesResult.rows.some(row => row.table_name === 'companies');
    
    if (companyTableExists) {
      // Check company count
      const companyCountResult = await client.query('SELECT COUNT(*) FROM companies');
      console.log(`Number of companies in the database: ${companyCountResult.rows[0].count}`);
      
      // Sample some company data
      if (parseInt(companyCountResult.rows[0].count) > 0) {
        const companySampleResult = await client.query('SELECT * FROM companies LIMIT 5');
        console.log('Sample company data:');
        console.log(JSON.stringify(companySampleResult.rows, null, 2));
      }
    } else {
      console.log('Companies table does not exist in the database');
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    // Close the client connection
    await client.end();
    console.log('Database connection closed');
  }
}

// Run the function
checkDatabase();
