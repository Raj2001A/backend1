// Simple Express server to test connectivity
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5002;

// Enable CORS for all routes
app.use(cors());

// Simple health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Employee Management API Test Server',
    status: 'running'
  });
});

// Health check endpoint for frontend compatibility
app.get('/api/backend/status', (req, res) => {
  res.json({ status: 'ok' });
});

// Mock employees endpoint
app.get('/api/employees', (req, res) => {
  res.json({
    success: true,
    data: {
      employees: [
        {
          id: '1',
          employeeId: 'EMP001',
          name: 'Test Employee',
          trade: 'Developer',
          nationality: 'Test',
          joinDate: '2023-01-01',
          dateOfBirth: '1990-01-01',
          mobileNumber: '1234567890',
          homePhoneNumber: '0987654321',
          email: 'test@example.com',
          companyId: '1',
          companyName: 'Test Company'
        }
      ],
      total: 1
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`API endpoint available at http://localhost:${PORT}/api/employees`);
});
