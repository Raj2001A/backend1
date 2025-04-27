import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Error types for better categorization
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  DATABASE = 'DATABASE_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  NETWORK = 'NETWORK_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

// Enhanced error interface
export interface AppError extends Error {
  statusCode?: number;
  errors?: any[];
  type?: ErrorType;
  isOperational?: boolean; // Indicates if this is an operational error that we expected might happen
  details?: any; // Additional error details
  code?: string; // Error code for client
}

// Function to determine error type
const getErrorType = (err: AppError): ErrorType => {
  // Check error message patterns
  const msg = err.message?.toLowerCase() || '';

  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required field')) {
    return ErrorType.VALIDATION;
  }

  if (msg.includes('database') || msg.includes('db') ||
      msg.includes('sql') || msg.includes('query') ||
      msg.includes('postgres') || msg.includes('connection') ||
      msg.includes('pool')) {
    return ErrorType.DATABASE;
  }

  if (msg.includes('auth') || msg.includes('login') ||
      msg.includes('password') || msg.includes('token') ||
      msg.includes('jwt')) {
    return ErrorType.AUTHENTICATION;
  }

  if (msg.includes('permission') || msg.includes('forbidden') ||
      msg.includes('access') || msg.includes('not allowed')) {
    return ErrorType.AUTHORIZATION;
  }

  if (msg.includes('not found') || msg.includes('missing') ||
      msg.includes('doesn\'t exist') || msg.includes('404')) {
    return ErrorType.NOT_FOUND;
  }

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return ErrorType.TIMEOUT;
  }

  if (msg.includes('network') || msg.includes('connection') ||
      msg.includes('econnreset') || msg.includes('socket')) {
    return ErrorType.NETWORK;
  }

  return ErrorType.UNKNOWN;
};

// Get appropriate status code based on error type
const getStatusCode = (type: ErrorType): number => {
  switch (type) {
    case ErrorType.VALIDATION:
      return 400; // Bad Request
    case ErrorType.AUTHENTICATION:
      return 401; // Unauthorized
    case ErrorType.AUTHORIZATION:
      return 403; // Forbidden
    case ErrorType.NOT_FOUND:
      return 404; // Not Found
    case ErrorType.TIMEOUT:
    case ErrorType.NETWORK:
    case ErrorType.DATABASE:
      return 503; // Service Unavailable
    case ErrorType.INTERNAL:
    case ErrorType.UNKNOWN:
    default:
      return 500; // Internal Server Error
  }
};

// Get user-friendly error message
const getUserFriendlyMessage = (err: AppError, type: ErrorType): string => {
  // For security, don't expose internal error details in production
  if (process.env.NODE_ENV === 'production') {
    switch (type) {
      case ErrorType.VALIDATION:
        return 'Invalid input data. Please check your request and try again.';
      case ErrorType.DATABASE:
        return 'Database operation failed. Please try again later.';
      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please check your credentials.';
      case ErrorType.AUTHORIZATION:
        return 'You do not have permission to perform this action.';
      case ErrorType.NOT_FOUND:
        return 'The requested resource was not found.';
      case ErrorType.TIMEOUT:
        return 'The request timed out. Please try again later.';
      case ErrorType.NETWORK:
        return 'Network error occurred. Please check your connection and try again.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  // In development, return the actual error message for debugging
  return err.message || 'Unknown error occurred';
};

// Enhanced error handler middleware
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Determine error type
  const errorType = err.type || getErrorType(err);

  // Set status code
  const statusCode = err.statusCode || getStatusCode(errorType);

  // Get user-friendly message
  const userMessage = getUserFriendlyMessage(err, errorType);

  // Extract errors array if available
  const errors = err.errors || [];

  // Log the error with context
  logger.error({
    message: `Error handling request: ${err.message}`,
    path: req.path,
    method: req.method,
    errorType,
    statusCode,
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userId: (req as any).user?.id || 'unauthenticated'
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: userMessage,
    error: errorType,
    errors: errors.length > 0 ? errors : undefined,
    // Only include details in development mode
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      details: err.details
    })
  });
};

// Not found middleware - enhanced version
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApplicationError(
    `Not Found - ${req.originalUrl}`,
    ErrorType.NOT_FOUND,
    404,
    true,
    { path: req.originalUrl }
  );
  next(error);
};

// Custom error class for application errors
export class ApplicationError extends Error implements AppError {
  statusCode: number;
  type: ErrorType;
  isOperational: boolean;
  details?: any;
  code?: string;
  errors?: any[];

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL,
    statusCode?: number,
    isOperational = true,
    details?: any,
    errors?: any[]
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = statusCode || getStatusCode(type);
    this.isOperational = isOperational;
    this.details = details;
    this.errors = errors;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: any, errors?: any[]) {
    super(message, ErrorType.VALIDATION, 400, true, details, errors);
  }
}

// Database error
export class DatabaseError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.DATABASE, 503, true, details);
  }
}

// Not found error
export class NotFoundError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.NOT_FOUND, 404, true, details);
  }
}

// Authentication error
export class AuthenticationError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.AUTHENTICATION, 401, true, details);
  }
}

// Authorization error
export class AuthorizationError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.AUTHORIZATION, 403, true, details);
  }
}

// Timeout error
export class TimeoutError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.TIMEOUT, 503, true, details);
  }
}

// Network error
export class NetworkError extends ApplicationError {
  constructor(message: string, details?: any) {
    super(message, ErrorType.NETWORK, 503, true, details);
  }
}

// For backward compatibility
export class ApiError extends ApplicationError {
  constructor(message: string, statusCode: number, errors?: any[]) {
    // Map status code to error type
    let type: ErrorType;
    switch (statusCode) {
      case 400: type = ErrorType.VALIDATION; break;
      case 401: type = ErrorType.AUTHENTICATION; break;
      case 403: type = ErrorType.AUTHORIZATION; break;
      case 404: type = ErrorType.NOT_FOUND; break;
      case 503: type = ErrorType.DATABASE; break;
      default: type = ErrorType.INTERNAL;
    }

    super(message, type, statusCode, true, undefined, errors);
  }

  // Static methods for backward compatibility
  static badRequest(message: string, errors?: any[]) {
    return new ValidationError(message, undefined, errors);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new AuthenticationError(message);
  }

  static forbidden(message: string = 'Forbidden') {
    return new AuthorizationError(message);
  }

  static notFound(message: string = 'Resource not found') {
    return new NotFoundError(message);
  }

  static internal(message: string = 'Internal server error') {
    return new ApplicationError(message, ErrorType.INTERNAL, 500);
  }

  static databaseError(message: string = 'Database connection error') {
    return new DatabaseError(message);
  }
}
