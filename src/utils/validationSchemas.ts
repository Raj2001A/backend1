// Validation schemas for API requests

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

// Common validation schemas
export const validationSchemas = {
  // Login validation
  login: {
    body: [
      { field: 'email', type: 'email', required: true },
      { field: 'password', type: 'string', required: true, min: 6 }
    ]
  },

  // Registration validation
  register: {
    body: [
      { field: 'name', type: 'string', required: true, min: 2, max: 100 },
      { field: 'email', type: 'email', required: true },
      { field: 'password', type: 'string', required: true, min: 6 },
      { field: 'trade', type: 'string', required: false },
      { field: 'nationality', type: 'string', required: false },
      { field: 'mobile_number', type: 'string', required: false },
      { field: 'home_phone_number', type: 'string', required: false },
      { field: 'company_id', type: 'string', required: false },
      { field: 'visa_expiry_date', type: 'date', required: false },
      { field: 'date_of_birth', type: 'date', required: false }
    ]
  },

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
        max: 100,
        custom: (value: any): boolean | string => {
          if (value && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 100)) {
            return 'Limit must be an integer between 1 and 100';
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
      { field: 'limit', type: 'number', required: false, min: 1, max: 100 }
    ]
  }
};
