const http = require('http');

// Function to make a GET request to the API
function testApiEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/${endpoint}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: jsonData });
        } catch (error) {
          reject(new Error(`Failed to parse JSON response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

// Test the employees endpoint
async function testEmployeesEndpoint() {
  try {
    console.log('Testing /api/employees endpoint...');
    const response = await testApiEndpoint('employees');
    
    console.log(`Status code: ${response.statusCode}`);
    console.log(`Total employees: ${response.data.count}`);
    console.log('Sample employee data:');
    console.log(JSON.stringify(response.data.data[0], null, 2));
    
    return response.data.count;
  } catch (error) {
    console.error('Error testing employees endpoint:', error.message);
    return 0;
  }
}

// Test the companies endpoint
async function testCompaniesEndpoint() {
  try {
    console.log('\nTesting /api/companies endpoint...');
    const response = await testApiEndpoint('companies');
    
    console.log(`Status code: ${response.statusCode}`);
    console.log(`Total companies: ${response.data.count}`);
    console.log('Sample company data:');
    console.log(JSON.stringify(response.data.data[0], null, 2));
    
    return response.data.count;
  } catch (error) {
    console.error('Error testing companies endpoint:', error.message);
    return 0;
  }
}

// Run the tests
async function runTests() {
  console.log('Starting API tests...');
  
  const employeeCount = await testEmployeesEndpoint();
  const companyCount = await testCompaniesEndpoint();
  
  console.log('\nTest Summary:');
  console.log(`- Employees: ${employeeCount}`);
  console.log(`- Companies: ${companyCount}`);
  
  if (employeeCount > 0 && companyCount > 0) {
    console.log('\nAPI is working correctly with real database data!');
    console.log('You can now use the frontend application to view and manage your employees.');
  } else {
    console.log('\nAPI tests failed. Please check the server logs for more information.');
  }
}

// Run the tests
runTests();
