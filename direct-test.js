const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get the connection string
const connectionString = process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL;

console.log('Attempting to connect with connection string:');
// Print connection string with password masked
const maskedConnectionString = connectionString.replace(/\/\/[^:]+:([^@]+)@/, '//[username]:[password]@');
console.log(maskedConnectionString);

// Create a client with direct connection
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testDirectConnection() {
  try {
    console.log('Attempting to connect to the database...');
    await client.connect();
    console.log('Successfully connected to the database!');
    
    // Test a simple query
    console.log('Testing a simple query...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Query result:', result.rows[0]);
    
    console.log('Connection test completed successfully!');
    return true;
  } catch (error) {
    console.error('Error connecting to the database:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. Please check if the database server is running and accessible.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Host not found. Please check the hostname in the connection string.');
    } else if (error.code === 'ECONNRESET') {
      console.error('Connection reset by peer. This might be due to network issues or firewall settings.');
    } else if (error.code === '28P01') {
      console.error('Authentication failed. Please check your username and password.');
    }
    
    return false;
  } finally {
    try {
      await client.end();
    } catch (err) {
      console.error('Error closing client:', err);
    }
  }
}

// Run the test
testDirectConnection()
  .then(success => {
    if (success) {
      console.log('Database connection test passed!');
      process.exit(0);
    } else {
      console.error('Database connection test failed!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error during test:', err);
    process.exit(1);
  });
