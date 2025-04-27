import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Track concurrent requests per IP
const concurrentRequests = new Map<string, number>();

// Maximum concurrent requests per IP
const MAX_CONCURRENT_REQUESTS = 20;

// Track request start times for timeout detection
const requestStartTimes = new Map<string, number>();

// Maximum request duration in ms (30 seconds)
const MAX_REQUEST_DURATION = 30000;

// Create a rate limiter for general API requests
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // Limit each IP to 120 requests per minute
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after a minute'
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      path: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again after a minute'
    });
  }
});

// Create a more lenient rate limiter for employee endpoints
export const employeeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many employee requests from this IP, please try again after a minute'
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Employee rate limit exceeded for IP: ${req.ip}`, {
      path: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      message: 'Too many employee requests from this IP, please try again after a minute'
    });
  }
});

// Create a more strict rate limiter for search endpoints
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 search requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many search requests from this IP, please try again after a minute'
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Search rate limit exceeded for IP: ${req.ip}`, {
      path: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      message: 'Too many search requests from this IP, please try again after a minute'
    });
  }
});

/**
 * Middleware to limit concurrent requests per IP
 */
export const concurrentRequestLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';

  // Increment concurrent request count for this IP
  const currentCount = (concurrentRequests.get(ip) || 0) + 1;
  concurrentRequests.set(ip, currentCount);

  // Store request start time for timeout detection
  const requestId = `${ip}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  requestStartTimes.set(requestId, Date.now());

  // Add request ID to request object for tracking
  (req as any).requestId = requestId;

  // Log concurrent request count if it's getting high
  if (currentCount > MAX_CONCURRENT_REQUESTS / 2) {
    logger.warn(`High concurrent request count for IP: ${ip}`, {
      concurrentCount: currentCount,
      maxConcurrent: MAX_CONCURRENT_REQUESTS,
      path: req.originalUrl,
      method: req.method
    });
  }

  // Check if this IP has too many concurrent requests
  if (currentCount > MAX_CONCURRENT_REQUESTS) {
    logger.error(`Too many concurrent requests from IP: ${ip}`, {
      concurrentCount: currentCount,
      maxConcurrent: MAX_CONCURRENT_REQUESTS,
      path: req.originalUrl,
      method: req.method
    });

    // Decrement the count since we're rejecting this request
    concurrentRequests.set(ip, currentCount - 1);

    // Remove request start time
    requestStartTimes.delete(requestId);

    return res.status(429).json({
      success: false,
      message: 'Too many concurrent requests. Please try again later.'
    });
  }

  // Set up response finished listener to decrement count
  res.on('finish', () => {
    // Get the current count (might have changed)
    const currentCount = concurrentRequests.get(ip) || 0;

    // Decrement count, but don't go below 0
    if (currentCount > 0) {
      concurrentRequests.set(ip, currentCount - 1);
    }

    // Remove request start time
    requestStartTimes.delete(requestId);

    // Calculate request duration
    const startTime = requestStartTimes.get(requestId);
    if (startTime) {
      const duration = Date.now() - startTime;

      // Log long-running requests
      if (duration > 5000) { // 5 seconds
        logger.warn(`Long-running request completed: ${duration}ms`, {
          ip,
          path: req.originalUrl,
          method: req.method,
          duration,
          statusCode: res.statusCode
        });
      }
    }
  });

  // Set up timeout check
  const timeoutCheck = setTimeout(() => {
    const startTime = requestStartTimes.get(requestId);
    if (startTime) {
      const duration = Date.now() - startTime;

      // If request is still running and has exceeded max duration
      if (duration > MAX_REQUEST_DURATION) {
        logger.error(`Request timeout detected: ${duration}ms`, {
          ip,
          path: req.originalUrl,
          method: req.method,
          requestId
        });

        // Note: We don't terminate the request here, just log it
        // The actual timeout should be handled by the server's timeout mechanism
      }
    }
  }, MAX_REQUEST_DURATION);

  // Ensure the timeout is cleared when the response finishes
  res.on('finish', () => {
    clearTimeout(timeoutCheck);
  });

  next();
};

/**
 * Middleware to detect and log suspicious request patterns
 */
export const suspiciousRequestDetector = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const referer = req.get('Referer') || 'none';

  // Check for suspicious patterns
  const suspiciousPatterns = [];

  // Missing or suspicious user agent
  if (!userAgent || userAgent === 'unknown' ||
      userAgent.includes('curl') ||
      userAgent.includes('python-requests') ||
      userAgent.includes('wget')) {
    suspiciousPatterns.push('suspicious_user_agent');
  }

  // Unusual HTTP methods for API
  if (['TRACE', 'TRACK', 'OPTIONS'].includes(req.method)) {
    suspiciousPatterns.push('unusual_http_method');
  }

  // Suspicious query parameters
  const suspiciousParams = ['sleep', 'waitfor', 'exec', 'eval', 'select', 'union', 'insert', 'drop', 'alert'];
  for (const param in req.query) {
    const value = String(req.query[param]);
    if (suspiciousParams.some(p => value.toLowerCase().includes(p))) {
      suspiciousPatterns.push('suspicious_query_param');
      break;
    }
  }

  // Log suspicious requests
  if (suspiciousPatterns.length > 0) {
    logger.warn(`Suspicious request detected from IP: ${ip}`, {
      patterns: suspiciousPatterns,
      ip,
      path: req.originalUrl,
      method: req.method,
      userAgent,
      referer
    });
  }

  next();
};
