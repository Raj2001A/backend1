import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Interface for performance metrics
interface PerformanceMetrics {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  contentLength?: number;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
}

// Global metrics storage
const metrics: PerformanceMetrics[] = [];
const MAX_METRICS_HISTORY = 1000;

// Generate a unique request ID
const generateRequestId = (): string => {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  // Add request ID
  const requestId = generateRequestId();
  req.headers['x-request-id'] = requestId;
  
  // Record start time
  const startTime = process.hrtime();
  
  // Add response listener
  res.on('finish', () => {
    // Calculate response time
    const hrTime = process.hrtime(startTime);
    const responseTime = hrTime[0] * 1000 + hrTime[1] / 1000000; // Convert to milliseconds
    
    // Create metrics object
    const metric: PerformanceMetrics = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      contentLength: parseInt(res.get('Content-Length') || '0', 10) || undefined,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date()
    };
    
    // Add to metrics history
    metrics.push(metric);
    
    // Trim metrics history if needed
    if (metrics.length > MAX_METRICS_HISTORY) {
      metrics.shift();
    }
    
    // Log performance metrics
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime.toFixed(2)}ms`,
      contentLength: metric.contentLength
    });
    
    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        responseTime: `${responseTime.toFixed(2)}ms`
      });
    }
  });
  
  next();
};

// Get all metrics
export const getMetrics = (): PerformanceMetrics[] => {
  return [...metrics];
};

// Get metrics summary
export const getMetricsSummary = () => {
  if (metrics.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      successRate: 0,
      requestsPerMinute: 0
    };
  }
  
  // Calculate metrics
  const totalRequests = metrics.length;
  const totalResponseTime = metrics.reduce((sum, metric) => sum + metric.responseTime, 0);
  const averageResponseTime = totalResponseTime / totalRequests;
  const minResponseTime = Math.min(...metrics.map(metric => metric.responseTime));
  const maxResponseTime = Math.max(...metrics.map(metric => metric.responseTime));
  
  // Calculate success rate
  const successfulRequests = metrics.filter(metric => metric.statusCode < 400).length;
  const successRate = (successfulRequests / totalRequests) * 100;
  
  // Calculate requests per minute
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  const requestsInLastMinute = metrics.filter(metric => metric.timestamp >= oneMinuteAgo).length;
  
  return {
    totalRequests,
    averageResponseTime,
    minResponseTime,
    maxResponseTime,
    successRate,
    requestsPerMinute: requestsInLastMinute
  };
};

// Get metrics by path
export const getMetricsByPath = () => {
  const pathMetrics: Record<string, {
    count: number;
    averageResponseTime: number;
    successRate: number;
  }> = {};
  
  // Group metrics by path
  metrics.forEach(metric => {
    // Extract base path without query parameters
    const basePath = metric.path.split('?')[0];
    
    if (!pathMetrics[basePath]) {
      pathMetrics[basePath] = {
        count: 0,
        averageResponseTime: 0,
        successRate: 0
      };
    }
    
    pathMetrics[basePath].count++;
    pathMetrics[basePath].averageResponseTime += metric.responseTime;
  });
  
  // Calculate averages
  Object.keys(pathMetrics).forEach(path => {
    const pathData = pathMetrics[path];
    pathData.averageResponseTime /= pathData.count;
    
    // Calculate success rate
    const successfulRequests = metrics
      .filter(metric => metric.path.split('?')[0] === path && metric.statusCode < 400)
      .length;
    
    pathData.successRate = (successfulRequests / pathData.count) * 100;
  });
  
  return pathMetrics;
};
