/**
 * Health Check Routes
 * 
 * Provides endpoints for checking the health of the application
 * and its dependencies (database, storage, etc.)
 */

import express from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { backendRegistry } from '../services/backendRegistry';
import websocketService from '../services/websocketService';
import schedulerService from '../services/schedulerService';

const router = express.Router();

// Get database connection pool
const getPool = (): Pool => {
  try {
    // Import database module dynamically to avoid circular dependencies
    const { pool } = require('../config/database');
    return pool;
  } catch (error) {
    logger.error('Error getting database pool', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

// Basic health check endpoint
router.get('/', async (req, res) => {
  try {
    // Check if server is running (this will always be true if we get here)
    const serverStatus = 'ok';
    
    // Return basic health status
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: serverStatus
    });
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Detailed health check endpoint
router.get('/detailed', async (req, res) => {
  try {
    // Check database connection
    let databaseStatus = 'unknown';
    let databaseError = null;
    
    try {
      const pool = getPool();
      const result = await pool.query('SELECT 1');
      databaseStatus = result.rows.length > 0 ? 'ok' : 'error';
    } catch (error) {
      databaseStatus = 'error';
      databaseError = error instanceof Error ? error.message : String(error);
      logger.error('Database health check failed', { error: databaseError });
    }
    
    // Check backend registry status
    const backendStatus = backendRegistry.getStatus();
    
    // Check WebSocket server status
    const websocketStatus = websocketService.getStatus();
    
    // Check scheduler status
    const schedulerStatus = schedulerService.getTaskStatus();
    
    // Return detailed health status
    res.status(200).json({
      status: databaseStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        server: 'ok',
        database: {
          status: databaseStatus,
          error: databaseError
        },
        backends: backendStatus,
        websocket: {
          status: 'ok',
          clients: websocketStatus.clients,
          maxClients: websocketStatus.maxClients
        },
        scheduler: {
          status: 'ok',
          tasks: schedulerStatus
        }
      }
    });
  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Detailed health check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Database health check endpoint
router.get('/database', async (req, res) => {
  try {
    // Check database connection
    let status = 'unknown';
    let error = null;
    let connectionTime = 0;
    let queryTime = 0;
    
    try {
      const pool = getPool();
      
      // Measure connection time
      const connectionStart = Date.now();
      const client = await pool.connect();
      connectionTime = Date.now() - connectionStart;
      
      try {
        // Measure query time
        const queryStart = Date.now();
        const result = await client.query('SELECT 1');
        queryTime = Date.now() - queryStart;
        
        status = result.rows.length > 0 ? 'ok' : 'error';
      } finally {
        // Release client back to pool
        client.release();
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
      logger.error('Database health check failed', { error });
    }
    
    res.status(status === 'ok' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      connectionTime,
      queryTime,
      error
    });
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Database health check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Backend services health check endpoint
router.get('/backends', async (req, res) => {
  try {
    // Get backend status
    const status = backendRegistry.getStatus();
    
    // Check if primary backend is online
    const primaryBackend = status.backends.find(b => b.id === 'primary');
    const isHealthy = primaryBackend && primaryBackend.status === 'online';
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      currentBackend: status.currentBackend,
      strategy: status.strategy,
      backends: status.backends
    });
  } catch (error) {
    logger.error('Backend services health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Backend services health check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// WebSocket health check endpoint
router.get('/websocket', (req, res) => {
  try {
    // Get WebSocket status
    const status = websocketService.getStatus();
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      clients: status.clients,
      maxClients: status.maxClients,
      channels: status.channels
    });
  } catch (error) {
    logger.error('WebSocket health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'WebSocket health check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Scheduler health check endpoint
router.get('/scheduler', (req, res) => {
  try {
    // Get scheduler status
    const tasks = schedulerService.getTaskStatus();
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      tasks
    });
  } catch (error) {
    logger.error('Scheduler health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Scheduler health check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
