import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './error';
import { logger } from '../utils/logger';

// Interface for validation rules
interface ValidationRule {
  field: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
  custom?: (value: any) => boolean | string;
}

// Interface for validation schema
interface ValidationSchema {
  [key: string]: ValidationRule[];
}

// Function to validate a value against a rule
const validateValue = (value: any, rule: ValidationRule): string | null => {
  // Check if required
  if (rule.required && (value === undefined || value === null || value === '')) {
    return rule.message || `${rule.field} is required`;
  }

  // If value is not provided and not required, skip other validations
  if (value === undefined || value === null || value === '') {
    return null;
  }

  // Check type
  if (rule.type) {
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return rule.message || `${rule.field} must be a string`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return rule.message || `${rule.field} must be a number`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return rule.message || `${rule.field} must be a boolean`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return rule.message || `${rule.field} must be an array`;
        }
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          return rule.message || `${rule.field} must be an object`;
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value))) {
          return rule.message || `${rule.field} must be a valid date`;
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return rule.message || `${rule.field} must be a valid email address`;
        }
        break;
      default:
        break;
    }
  }

  // Check min/max for strings and arrays
  if (typeof value === 'string' || Array.isArray(value)) {
    if (rule.min !== undefined && value.length < rule.min) {
      return rule.message || `${rule.field} must be at least ${rule.min} characters long`;
    }
    if (rule.max !== undefined && value.length > rule.max) {
      return rule.message || `${rule.field} must be at most ${rule.max} characters long`;
    }
  }

  // Check min/max for numbers
  if (typeof value === 'number' || !isNaN(Number(value))) {
    const numValue = typeof value === 'number' ? value : Number(value);
    if (rule.min !== undefined && numValue < rule.min) {
      return rule.message || `${rule.field} must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && numValue > rule.max) {
      return rule.message || `${rule.field} must be at most ${rule.max}`;
    }
  }

  // Check pattern
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return rule.message || `${rule.field} has an invalid format`;
  }

  // Check custom validation
  if (rule.custom) {
    const result = rule.custom(value);
    if (typeof result === 'string') {
      return result;
    }
    if (result === false) {
      return rule.message || `${rule.field} is invalid`;
    }
  }

  return null;
};

// Function to validate a request against a schema (returns error array)
export const validateRequestFunction = (req: Request, schema: ValidationSchema): string[] => {
  const errors: string[] = [];

  // Validate body
  if (schema.body) {
    schema.body.forEach(rule => {
      const value = req.body?.[rule.field];
      const error = validateValue(value, rule);
      if (error) {
        errors.push(error);
      }
    });
  }

  // Validate query
  if (schema.query) {
    schema.query.forEach(rule => {
      const value = req.query?.[rule.field];
      const error = validateValue(value, rule);
      if (error) {
        errors.push(error);
      }
    });
  }

  // Validate params
  if (schema.params) {
    schema.params.forEach(rule => {
      const value = req.params?.[rule.field];
      const error = validateValue(value, rule);
      if (error) {
        errors.push(error);
      }
    });
  }

  return errors;
};

// Express middleware for validation (calls function above)
export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validateRequestFunction(req, schema);
    if (errors.length > 0) {
      logger.warn('Validation failed', {
        path: req.path,
        method: req.method,
        errors,
        body: req.body,
        query: req.query,
        params: req.params
      });
      return next(new ValidationError('Validation failed', { errors }, errors));
    }
    next();
  };
};

// Middleware factory for request validation
export const validate = (schema: ValidationSchema) => {
  return validateRequest(schema);
};

// Common validation schemas
export const validationSchemas = {
  // Employee validation
  employee: {
    body: [
      { field: 'name', type: 'string', required: true, min: 2, max: 100 },
      { field: 'employee_id', type: 'string', required: true, min: 2, max: 50 },
      { field: 'email', type: 'email', required: true },
      { field: 'trade', type: 'string', required: true },
      { field: 'nationality', type: 'string', required: true },
      { field: 'company_id', type: 'string', required: true },
      { field: 'mobile_number', type: 'string', required: true,
        pattern: /^[+]?[0-9]{8,15}$/,
        message: 'Mobile number must be a valid phone number'
      },
      { field: 'home_phone_number', type: 'string', required: false },
      { field: 'join_date', type: 'date', required: false },
      { field: 'date_of_birth', type: 'date', required: false },
      { field: 'visa_expiry_date', type: 'date', required: false }
    ]
  },

  // Company validation
  company: {
    body: [
      { field: 'name', type: 'string', required: true, min: 2, max: 100 },
      { field: 'location', type: 'string', required: false }
    ]
  },

  // Document validation
  document: {
    body: [
      { field: 'employee_id', type: 'string', required: true },
      { field: 'document_type', type: 'string', required: true },
      { field: 'file_name', type: 'string', required: true },
      { field: 'file_path', type: 'string', required: true },
      { field: 'mime_type', type: 'string', required: true },
      { field: 'expiry_date', type: 'date', required: false }
    ]
  },

  // Pagination validation
  pagination: {
    query: [
      {
        field: 'page',
        type: 'number',
        required: false,
        min: 1,
        custom: (value: any): boolean | string => {
          if (value && (!Number.isInteger(Number(value)) || Number(value) < 1)) {
            return 'Page must be a positive integer';
          }
          return true;
        }
      },
      {
        field: 'limit',
        type: 'number',
        required: false,
        min: 1,
        max: 10000,
        custom: (value: any): boolean | string => {
          if (value && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 10000)) {
            return 'Limit must be an integer between 1 and 10000';
          }
          return true;
        }
      }
    ]
  },

  // ID validation
  id: {
    params: [
      { field: 'id', type: 'string', required: true }
    ]
  },

  // Search validation
  search: {
    params: [
      { field: 'query', type: 'string', required: true, min: 1 }
    ],
    query: [
      { field: 'page', type: 'number', required: false, min: 1 },
      { field: 'limit', type: 'number', required: false, min: 1, max: 10000 }
    ]
  }
};

// Sanitize request data to prevent injection attacks
export const sanitize = (req: Request, res: Response, next: NextFunction) => {
  // Function to sanitize a string
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;

    // Remove potentially dangerous characters
    return str
      .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
      .replace(/javascript:/gi, '') // Remove javascript: to prevent script injection
      .trim(); // Trim whitespace
  };

  // Function to recursively sanitize an object
  const sanitizeObject = (obj: any): any => {
    if (!obj) return obj;

    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }

    return obj;
  };

  // Sanitize request body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};
