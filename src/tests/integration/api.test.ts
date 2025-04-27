import request from 'supertest';
import app from '../../index';
import { backendRegistry } from '../../services/backendRegistry';

// Mock the backend registry
jest.mock('../../services/backendRegistry', () => ({
  backendRegistry: {
    getStatus: jest.fn().mockReturnValue({
      currentBackend: 'mock',
      strategy: 'priority',
      backends: [
        {
          id: 'mock',
          name: 'Mock Database',
          status: 'online',
        },
      ],
    }),
    query: jest.fn(),
    getClient: jest.fn(),
  },
}));

describe('API Integration Tests', () => {
  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Employee Management API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('status', 'running');
    });
  });

  describe('Authentication', () => {
    describe('POST /api/auth/login', () => {
      it('should authenticate admin user in development mode', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@example.com',
            password: 'password123',
          });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data.user).toHaveProperty('role', 'Administrator');
        expect(response.body.data).toHaveProperty('token');
      });

      it('should return validation error for missing fields', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@example.com',
          });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Validation failed');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Not Found');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to API routes', async () => {
      // This test is a placeholder since we can't easily test rate limiting in a unit test
      // In a real test, we would make multiple requests and check for 429 status
      const response = await request(app).get('/api/employees');
      
      // Just check that the route exists and returns something
      expect(response.status).toBe(401); // Unauthorized because we didn't provide a token
    });
  });
});
