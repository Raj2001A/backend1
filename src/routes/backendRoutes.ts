/**
 * Backend status and management routes
 */

import express from 'express';
import { backendRegistry } from '../services/backendRegistry';
import { SelectionStrategy } from '../config/backends';
import { logger } from '../utils/logger';
import { AuthenticationError } from '../middleware/error';

const router = express.Router();

// Middleware to check admin access
const checkAdminAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // In a real app, you would check the user's role from the JWT token
  // For now, we'll use a simple API key check
  const apiKey = req.headers['x-api-key'];

  if (process.env.NODE_ENV === 'development' || apiKey === process.env.ADMIN_API_KEY) {
    next();
  } else {
    next(new AuthenticationError('Admin access required'));
  }
};

// Get backend status
router.get('/status', (req, res) => {
  const status = backendRegistry.getStatus();
  res.json(status);
});

// Check database connection
router.get('/database-check', async (req, res, next) => {
  try {
    // Get the status of all backends
    const status = backendRegistry.getStatus();

    // Find the primary backend from the status
    const primaryBackend = status.backends.find(b => b.id === 'primary');

    if (!primaryBackend) {
      return res.json({
        connected: false,
        message: 'Primary database backend not found',
        error: 'Configuration error: No primary backend defined'
      });
    }

    // Check if the backend is enabled
    if (!primaryBackend.enabled) {
      return res.json({
        connected: false,
        message: 'Primary database backend is disabled',
        error: 'Backend disabled'
      });
    }

    try {
      // Try to execute a simple query to check the connection
      // We'll use the backendRegistry to execute the query
      const result = await backendRegistry.query('SELECT 1 as connection_test');

      return res.json({
        connected: true,
        message: 'Database connection successful',
        data: { result }
      });
    } catch (dbError) {
      logger.error('Database connection check failed:', {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });

      return res.json({
        connected: false,
        message: 'Database connection failed',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Switch to a specific backend
router.post('/switch/:backendId', checkAdminAccess, async (req, res, next) => {
  try {
    const { backendId } = req.params;
    const success = await backendRegistry.switchBackend(backendId);

    if (success) {
      logger.info(`Manually switched to backend ${backendId}`);
      res.json({
        success: true,
        message: `Successfully switched to backend ${backendId}`,
        data: backendRegistry.getStatus()
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Failed to switch to backend ${backendId}`
      });
    }
  } catch (error) {
    next(error);
  }
});

// Change backend selection strategy
router.post('/strategy', checkAdminAccess, (req, res, next) => {
  try {
    const { strategy } = req.body;

    if (!strategy || !Object.values(SelectionStrategy).includes(strategy as SelectionStrategy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid strategy. Must be one of: ${Object.values(SelectionStrategy).join(', ')}`
      });
    }

    backendRegistry.setSelectionStrategy(strategy as SelectionStrategy);

    logger.info(`Backend selection strategy changed to ${strategy}`);
    res.json({
      success: true,
      message: `Successfully changed selection strategy to ${strategy}`,
      data: backendRegistry.getStatus()
    });
  } catch (error) {
    next(error);
  }
});

// Enable or disable a backend
router.post('/toggle/:backendId', checkAdminAccess, (req, res, next) => {
  try {
    const { backendId } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: enabled'
      });
    }

    const success = backendRegistry.setBackendEnabled(backendId, enabled);

    if (success) {
      logger.info(`Backend ${backendId} ${enabled ? 'enabled' : 'disabled'}`);
      res.json({
        success: true,
        message: `Successfully ${enabled ? 'enabled' : 'disabled'} backend ${backendId}`,
        data: backendRegistry.getStatus()
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Failed to ${enabled ? 'enable' : 'disable'} backend ${backendId}`
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
