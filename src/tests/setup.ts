// @ts-ignore
// eslint-disable-next-line
// @ts-nocheck

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '5003';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ADMIN_API_KEY = 'test-admin-api-key';

// Mock environment variables for Backblaze B2
process.env.B2_APP_KEY_ID = 'test-b2-key-id';
process.env.B2_APP_KEY = 'test-b2-app-key';
process.env.B2_BUCKET_ID = 'test-b2-bucket-id';
process.env.B2_BUCKET_NAME = 'test-b2-bucket-name';

// Mock environment variables for Firebase
process.env.FIREBASE_PROJECT_ID = 'test-firebase-project-id';
process.env.FIREBASE_PRIVATE_KEY = 'test-firebase-private-key';
process.env.FIREBASE_CLIENT_EMAIL = 'test-firebase-client-email';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
};

// Clean up after all tests
afterAll(async () => {
  // Add any cleanup code here
});
