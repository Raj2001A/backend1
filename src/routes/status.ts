/**
 * Status Routes
 * 
 * Provides endpoints for checking the status of the application
 * and its components (database, storage, etc.)
 */

import express from 'express';
import os from 'os';
import { logger } from '../utils/logger';
import { backendRegistry } from '../services/backendRegistry';
import websocketService from '../services/websocketService';
import schedulerService from '../services/schedulerService';

const router = express.Router();

// Get system information
const getSystemInfo = () => {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    processUptime: process.uptime(),
    nodeVersion: process.version,
    pid: process.pid
  };
};

// Basic status endpoint
router.get('/', (req, res) => {
  try {
    // Get backend status
    const backendStatus = backendRegistry.getStatus();
    
    // Get WebSocket status
    const websocketStatus = websocketService.getStatus();
    
    // Get scheduler status
    const schedulerStatus = schedulerService.getTaskStatus();
    
    // Get system information
    const systemInfo = getSystemInfo();
    
    // Return status
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: systemInfo,
      services: {
        backends: {
          status: backendStatus.backends.every(b => b.status === 'online') ? 'ok' : 'degraded',
          currentBackend: backendStatus.currentBackend,
          strategy: backendStatus.strategy,
          count: backendStatus.backends.length,
          online: backendStatus.backends.filter(b => b.status === 'online').length
        },
        websocket: {
          status: 'ok',
          clients: websocketStatus.clients,
          maxClients: websocketStatus.maxClients
        },
        scheduler: {
          status: 'ok',
          tasks: schedulerStatus.length
        }
      }
    });
  } catch (error) {
    logger.error('Status check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Status check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Detailed status endpoint
router.get('/detailed', (req, res) => {
  try {
    // Get backend status
    const backendStatus = backendRegistry.getStatus();
    
    // Get WebSocket status
    const websocketStatus = websocketService.getStatus();
    
    // Get scheduler status
    const schedulerStatus = schedulerService.getTaskStatus();
    
    // Get system information
    const systemInfo = getSystemInfo();
    
    // Calculate memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageFormatted = {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    };
    
    // Return detailed status
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: {
        ...systemInfo,
        memoryUsage: memoryUsageFormatted,
        loadAverage: os.loadavg()
      },
      services: {
        backends: {
          status: backendStatus.backends.every(b => b.status === 'online') ? 'ok' : 'degraded',
          currentBackend: backendStatus.currentBackend,
          strategy: backendStatus.strategy,
          backends: backendStatus.backends
        },
        websocket: {
          status: 'ok',
          clients: websocketStatus.clients,
          maxClients: websocketStatus.maxClients,
          channels: websocketStatus.channels
        },
        scheduler: {
          status: 'ok',
          tasks: schedulerStatus
        }
      }
    });
  } catch (error) {
    logger.error('Detailed status check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Detailed status check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// System information endpoint
router.get('/system', (req, res) => {
  try {
    // Get system information
    const systemInfo = getSystemInfo();
    
    // Calculate memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageFormatted = {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    };
    
    // Return system information
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: {
        ...systemInfo,
        memoryUsage: memoryUsageFormatted,
        loadAverage: os.loadavg(),
        networkInterfaces: os.networkInterfaces()
      }
    });
  } catch (error) {
    logger.error('System information check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      status: 'error',
      message: 'System information check failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
