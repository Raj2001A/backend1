import express from 'express';
import { getMetrics, getMetricsSummary, getMetricsByPath } from '../middleware/performance';
import { checkAdminAccess } from '../middleware/auth';
import { logger } from '../utils/logger';
import os from 'os';

const router = express.Router();

/**
 * @route   GET /api/monitoring/health
 * @desc    Get system health status
 * @access  Public
 */
router.get('/health', (req, res) => {
  // Basic health check
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

/**
 * @route   GET /api/monitoring/metrics
 * @desc    Get performance metrics
 * @access  Private (Admin)
 */
router.get('/metrics', checkAdminAccess, (req, res) => {
  try {
    const metrics = getMetrics();
    res.json({
      success: true,
      count: metrics.length,
      data: metrics
    });
  } catch (error) {
    logger.error('Error getting metrics', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get metrics'
    });
  }
});

/**
 * @route   GET /api/monitoring/summary
 * @desc    Get performance metrics summary
 * @access  Private (Admin)
 */
router.get('/summary', checkAdminAccess, (req, res) => {
  try {
    const summary = getMetricsSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error getting metrics summary', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get metrics summary'
    });
  }
});

/**
 * @route   GET /api/monitoring/paths
 * @desc    Get performance metrics by path
 * @access  Private (Admin)
 */
router.get('/paths', checkAdminAccess, (req, res) => {
  try {
    const pathMetrics = getMetricsByPath();
    res.json({
      success: true,
      count: Object.keys(pathMetrics).length,
      data: pathMetrics
    });
  } catch (error) {
    logger.error('Error getting path metrics', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get path metrics'
    });
  }
});

/**
 * @route   GET /api/monitoring/system
 * @desc    Get system information
 * @access  Private (Admin)
 */
router.get('/system', checkAdminAccess, (req, res) => {
  try {
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      cpus: os.cpus(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg()
    };
    
    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    logger.error('Error getting system information', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get system information'
    });
  }
});

export default router;
