import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import http from 'http';
import { errorHandler, notFound } from './middleware/error';
import { sanitize } from './middleware/validation';
import { apiLimiter, employeeLimiter, searchLimiter, concurrentRequestLimiter, suspiciousRequestDetector } from './middleware/rateLimiter';
import { performanceMonitor } from './middleware/performance';
import { logger } from './utils/logger';
import employeeRoutes from './routes/employeeRoutes';
import companyRoutes from './routes/companyRoutes';
import importRoutes from './routes/importRoutes';
import backendRoutes from './routes/backendRoutes';
import authRoutes from './routes/authRoutes';
import documentRoutes from './routes/documentRoutes';
import documentChunkingRoutes from './routes/documentChunking';
import monitoringRoutes from './routes/monitoringRoutes';
import healthRoutes from './routes/health';
import statusRoutes from './routes/status';
import { backendRegistry } from './services/backendRegistry';
import websocketService from './services/websocketService';
import schedulerService from './services/schedulerService';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers

// Configure CORS to allow requests from your frontend
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://cubstechnical.com']
    : '*', // Restrict in production, allow all in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'cache-control', 'pragma'],
  credentials: true
}));

// Request logging and performance monitoring middleware
app.use(performanceMonitor);
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id']
  });
  next();
});

// Request parsing middleware
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies with size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Request sanitization middleware
app.use(sanitize);

// Apply concurrent request limiter and suspicious request detector
app.use(concurrentRequestLimiter);
app.use(suspiciousRequestDetector);

// Add request timeout middleware
app.use((req, res, next) => {
  // Set a timeout for all requests (30 seconds)
  req.setTimeout(30000, () => {
    logger.warn(`Request timeout: ${req.method} ${req.originalUrl}`);
    res.status(503).json({
      success: false,
      message: 'Request timed out. Please try again later.'
    });
  });
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Employee Management API',
    version: '1.0.0',
    status: 'running'
  });
});

// Apply rate limiters to API routes
app.use('/api', apiLimiter); // Apply general rate limiter to all API routes

// API routes with specific rate limiters
app.use('/api/employees', employeeLimiter, employeeRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/import', importRoutes);
app.use('/api/backend', backendRoutes);

// Authentication routes
app.use('/api/auth', authRoutes);

// Document routes
app.use('/api/documents', documentRoutes);
app.use('/api/document-chunks', documentChunkingRoutes);

// Monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// Health check and status routes
app.use('/health', healthRoutes);
app.use('/status', statusRoutes);

// Health check endpoint for frontend compatibility
app.get('/api/backend/status', (req, res) => {
  res.json({ status: 'ok' });
});

// TODO: Add more routes as needed

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// Initialize backend registry and start server
Promise.resolve().then(() => {
  // Initialize WebSocket server
  websocketService.initialize(server);

  // Start scheduler service
  schedulerService.start();

  // Start HTTP server
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Log backend status
    const backendStatus = backendRegistry.getStatus();
    logger.info(`Active backend: ${backendStatus.currentBackend || 'none'}`);
    logger.info(`Backend selection strategy: ${backendStatus.strategy}`);

    if (backendStatus.backends.some(b => b.status === 'offline')) {
      logger.warn('Some backends are offline. Failover may be active.');
    }
  });

  // Set server timeout
  server.timeout = 60000; // 60 seconds

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    console.log(`${signal} received. Shutting down gracefully...`);

    // Shutdown services
    schedulerService.stop();
    logger.info('Scheduler service stopped');

    websocketService.shutdown();
    logger.info('WebSocket server closed');

    server.close(() => {
      logger.info('HTTP server closed');
      console.log('HTTP server closed');

      // Close database connections and other resources here
      process.exit(0);
    });

    // Force close if graceful shutdown fails
    setTimeout(() => {
      logger.error('Forcing shutdown after timeout');
      console.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection:', { error: err.message, stack: err.stack });
  console.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  console.error('Uncaught Exception:', err);

  // In production, exit after uncaught exception
  if (process.env.NODE_ENV === 'production') {
    logger.error('Uncaught exception in production. Exiting process.');
    process.exit(1);
  }
});

export default app;
