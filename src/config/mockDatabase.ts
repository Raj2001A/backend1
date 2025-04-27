/**
 * Mock database implementation for testing and fallback
 */

import { PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

// Sample data for mock database
interface Employee {
  id: string;
  employee_id: string;
  name: string;
  trade: string;
  nationality: string;
  join_date: Date;
  date_of_birth: Date | null;
  mobile_number: string;
  home_phone_number: string;
  email: string;
  company_id: string;
  company_name: string;
  created_at: Date;
  updated_at: Date;
}

interface Company {
  id: string;
  name: string;
  location: string;
  created_at: Date;
  updated_at: Date;
}

interface Document {
  id: string;
  employee_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  expiry_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface SampleData {
  employees: Employee[];
  companies: Company[];
  documents: Document[];
}

const sampleData: SampleData = {
  employees: [
    {
      id: '1',
      employee_id: 'EMP001',
      name: 'John Doe',
      trade: 'Engineer',
      nationality: 'USA',
      join_date: new Date('2023-01-15'),
      date_of_birth: new Date('1985-05-20'),
      mobile_number: '+1234567890',
      home_phone_number: '+1987654321',
      email: 'john.doe@example.com',
      company_id: '1',
      company_name: 'Cub Technical Services',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '2',
      employee_id: 'EMP002',
      name: 'Jane Smith',
      trade: 'Project Manager',
      nationality: 'UK',
      join_date: new Date('2023-02-10'),
      date_of_birth: new Date('1990-08-15'),
      mobile_number: '+1234567891',
      home_phone_number: '+1987654322',
      email: 'jane.smith@example.com',
      company_id: '1',
      company_name: 'Cub Technical Services',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '3',
      employee_id: 'EMP003',
      name: 'Ahmed Ali',
      trade: 'Technician',
      nationality: 'UAE',
      join_date: new Date('2023-03-05'),
      date_of_birth: new Date('1988-11-10'),
      mobile_number: '+9715551234',
      home_phone_number: '+9715554321',
      email: 'ahmed.ali@example.com',
      company_id: '2',
      company_name: 'Cub Technical International',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  companies: [
    {
      id: '1',
      name: 'Cub Technical Services',
      location: 'Dubai, UAE',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '2',
      name: 'Cub Technical International',
      location: 'Abu Dhabi, UAE',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '3',
      name: 'Cub Technical Maintenance',
      location: 'Sharjah, UAE',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],
  documents: [
    {
      id: '1',
      employee_id: '1',
      document_type: 'Passport',
      file_name: 'passport.pdf',
      file_path: '/documents/1/passport.pdf',
      mime_type: 'application/pdf',
      expiry_date: new Date('2028-01-15'),
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '2',
      employee_id: '1',
      document_type: 'Visa',
      file_name: 'visa.pdf',
      file_path: '/documents/1/visa.pdf',
      mime_type: 'application/pdf',
      expiry_date: new Date('2024-01-15'),
      created_at: new Date(),
      updated_at: new Date()
    }
  ]
};

// Mock database implementation
const mockDb = {
  query: async (text: string, params?: any[]): Promise<QueryResult<any>> => {
    logger.info('Using mock database', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params
    });

    try {
      // Parse the query to determine what to return
      const lowerText = text.toLowerCase();

      // Handle SELECT queries
      if (lowerText.includes('select')) {
        // Determine which table to query
        if (lowerText.includes('employees')) {
          return handleEmployeeQuery(text, params);
        } else if (lowerText.includes('companies')) {
          return handleCompanyQuery(text, params);
        } else if (lowerText.includes('documents')) {
          return handleDocumentQuery(text, params);
        } else if (lowerText.includes('now()')) {
          // Health check query
          return {
            rows: [{ now: new Date() }],
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: []
          };
        }
      }
      // Handle INSERT queries
      else if (lowerText.includes('insert')) {
        if (lowerText.includes('employees')) {
          return handleEmployeeInsert(text, params);
        } else if (lowerText.includes('companies')) {
          return handleCompanyInsert(text, params);
        } else if (lowerText.includes('documents')) {
          return handleDocumentInsert(text, params);
        }
      }
      // Handle UPDATE queries
      else if (lowerText.includes('update')) {
        if (lowerText.includes('employees')) {
          return handleEmployeeUpdate(text, params);
        } else if (lowerText.includes('companies')) {
          return handleCompanyUpdate(text, params);
        } else if (lowerText.includes('documents')) {
          return handleDocumentUpdate(text, params);
        }
      }
      // Handle DELETE queries
      else if (lowerText.includes('delete')) {
        if (lowerText.includes('employees')) {
          return handleEmployeeDelete(text, params);
        } else if (lowerText.includes('companies')) {
          return handleCompanyDelete(text, params);
        } else if (lowerText.includes('documents')) {
          return handleDocumentDelete(text, params);
        }
      }

      // Default empty response
      return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
    } catch (error) {
      logger.error('Error in mock database query', {
        error: error instanceof Error ? error.message : String(error),
        query: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      });
      throw error;
    }
  },

  connect: async (): Promise<PoolClient> => {
    const mockClient = {
      query: async (text: string, params?: any[]): Promise<QueryResult<any>> => {
        return mockDb.query(text, params);
      },
      release: () => {},
      // Add other required properties to match PoolClient interface
      on: () => mockClient,
      off: () => mockClient,
      once: () => mockClient,
      removeListener: () => mockClient,
      removeAllListeners: () => mockClient,
      listeners: () => [],
      listenerCount: () => 0,
      emit: () => false,
      eventNames: () => [],
      prependListener: () => mockClient,
      prependOnceListener: () => mockClient,
      rawCopyTo: async () => 0,
      rawCopyFrom: async () => 0,
      copyTo: async () => 0,
      copyFrom: async () => 0,
      pauseDrain: () => {},
      resumeDrain: () => {},
      escapeIdentifier: () => '',
      escapeLiteral: () => ''
    } as unknown as PoolClient;

    return mockClient;
  },

  end: async (): Promise<void> => {}
};

// Helper functions for handling different query types

// Handle employee queries
function handleEmployeeQuery(text: string, params?: any[]): QueryResult<any> {
  const lowerText = text.toLowerCase();

  // Handle count query
  if (lowerText.includes('count(*)')) {
    return {
      rows: [{ count: sampleData.employees.length }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  // Handle query by ID
  if (lowerText.includes('where') && lowerText.includes('id =')) {
    const idMatch = text.match(/id\s*=\s*\$(\d+)/i);
    if (idMatch && params) {
      const paramIndex = parseInt(idMatch[1]) - 1;
      const id = params[paramIndex];
      const employee = sampleData.employees.find(e => e.id === id);

      return {
        rows: employee ? [employee] : [],
        command: 'SELECT',
        rowCount: employee ? 1 : 0,
        oid: 0,
        fields: []
      };
    }
  }

  // Handle query by company ID
  if (lowerText.includes('where') && lowerText.includes('company_id =')) {
    const companyIdMatch = text.match(/company_id\s*=\s*\$(\d+)/i);
    if (companyIdMatch && params) {
      const paramIndex = parseInt(companyIdMatch[1]) - 1;
      const companyId = params[paramIndex];
      const employees = sampleData.employees.filter(e => e.company_id === companyId);

      // Handle pagination
      const limit = getQueryLimit(text, params);
      const offset = getQueryOffset(text, params);
      const paginatedEmployees = employees.slice(offset, offset + limit);

      return {
        rows: paginatedEmployees,
        command: 'SELECT',
        rowCount: paginatedEmployees.length,
        oid: 0,
        fields: []
      };
    }
  }

  // Handle search query
  if (lowerText.includes('where') && lowerText.includes('ilike')) {
    const searchTermMatch = text.match(/ilike\s*\$(\d+)/i);
    if (searchTermMatch && params) {
      const paramIndex = parseInt(searchTermMatch[1]) - 1;
      const searchTerm = params[paramIndex].replace(/%/g, '').toLowerCase();

      const employees = sampleData.employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm) ||
        e.employee_id.toLowerCase().includes(searchTerm) ||
        e.email.toLowerCase().includes(searchTerm) ||
        e.trade.toLowerCase().includes(searchTerm) ||
        e.nationality.toLowerCase().includes(searchTerm)
      );

      // Handle pagination
      const limit = getQueryLimit(text, params);
      const offset = getQueryOffset(text, params);
      const paginatedEmployees = employees.slice(offset, offset + limit);

      return {
        rows: paginatedEmployees,
        command: 'SELECT',
        rowCount: paginatedEmployees.length,
        oid: 0,
        fields: []
      };
    }
  }

  // Default: return all employees with pagination
  const limit = getQueryLimit(text, params);
  const offset = getQueryOffset(text, params);
  const paginatedEmployees = sampleData.employees.slice(offset, offset + limit);

  return {
    rows: paginatedEmployees,
    command: 'SELECT',
    rowCount: paginatedEmployees.length,
    oid: 0,
    fields: []
  };
}

// Handle company queries
function handleCompanyQuery(text: string, params?: any[]): QueryResult<any> {
  const lowerText = text.toLowerCase();

  // Handle count query
  if (lowerText.includes('count(*)')) {
    return {
      rows: [{ count: sampleData.companies.length }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  // Handle query by ID
  if (lowerText.includes('where') && lowerText.includes('id =')) {
    const idMatch = text.match(/id\s*=\s*\$(\d+)/i);
    if (idMatch && params) {
      const paramIndex = parseInt(idMatch[1]) - 1;
      const id = params[paramIndex];
      const company = sampleData.companies.find(c => c.id === id);

      return {
        rows: company ? [company] : [],
        command: 'SELECT',
        rowCount: company ? 1 : 0,
        oid: 0,
        fields: []
      };
    }
  }

  // Default: return all companies
  return {
    rows: sampleData.companies,
    command: 'SELECT',
    rowCount: sampleData.companies.length,
    oid: 0,
    fields: []
  };
}

// Handle document queries
function handleDocumentQuery(text: string, params?: any[]): QueryResult<any> {
  const lowerText = text.toLowerCase();

  // Handle count query
  if (lowerText.includes('count(*)')) {
    return {
      rows: [{ count: sampleData.documents.length }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  // Handle query by ID
  if (lowerText.includes('where') && lowerText.includes('id =')) {
    const idMatch = text.match(/id\s*=\s*\$(\d+)/i);
    if (idMatch && params) {
      const paramIndex = parseInt(idMatch[1]) - 1;
      const id = params[paramIndex];
      const document = sampleData.documents.find(d => d.id === id);

      return {
        rows: document ? [document] : [],
        command: 'SELECT',
        rowCount: document ? 1 : 0,
        oid: 0,
        fields: []
      };
    }
  }

  // Handle query by employee ID
  if (lowerText.includes('where') && lowerText.includes('employee_id =')) {
    const employeeIdMatch = text.match(/employee_id\s*=\s*\$(\d+)/i);
    if (employeeIdMatch && params) {
      const paramIndex = parseInt(employeeIdMatch[1]) - 1;
      const employeeId = params[paramIndex];
      const documents = sampleData.documents.filter(d => d.employee_id === employeeId);

      return {
        rows: documents,
        command: 'SELECT',
        rowCount: documents.length,
        oid: 0,
        fields: []
      };
    }
  }

  // Default: return all documents
  return {
    rows: sampleData.documents,
    command: 'SELECT',
    rowCount: sampleData.documents.length,
    oid: 0,
    fields: []
  };
}

// Handle employee insert
function handleEmployeeInsert(text: string, params?: any[]): QueryResult<any> {
  // Generate a new ID
  const newId = (Math.max(...sampleData.employees.map(e => parseInt(e.id))) + 1).toString();

  // Create a new employee object
  const newEmployee: Employee = {
    id: newId,
    employee_id: params?.[0] || `EMP${newId.padStart(3, '0')}`,
    name: params?.[1] || 'New Employee',
    trade: params?.[2] || 'Unknown',
    nationality: params?.[3] || 'Unknown',
    join_date: params?.[4] ? new Date(params[4]) : new Date(),
    date_of_birth: params?.[5] ? new Date(params[5]) : null,
    mobile_number: params?.[6] || '',
    home_phone_number: params?.[7] || '',
    email: params?.[8] || 'employee@example.com',
    company_id: params?.[9] || '1',
    company_name: 'Cub Technical Services', // Would be joined in a real query
    created_at: new Date(),
    updated_at: new Date()
  };

  // Add to sample data
  sampleData.employees.push(newEmployee);

  return {
    rows: [newEmployee],
    command: 'INSERT',
    rowCount: 1,
    oid: 0,
    fields: []
  };
}

// Handle company insert
function handleCompanyInsert(text: string, params?: any[]): QueryResult<any> {
  // Generate a new ID
  const newId = (Math.max(...sampleData.companies.map(c => parseInt(c.id))) + 1).toString();

  // Create a new company object
  const newCompany: Company = {
    id: newId,
    name: params?.[0] || 'New Company',
    location: params?.[1] || 'Unknown',
    created_at: new Date(),
    updated_at: new Date()
  };

  // Add to sample data
  sampleData.companies.push(newCompany);

  return {
    rows: [newCompany],
    command: 'INSERT',
    rowCount: 1,
    oid: 0,
    fields: []
  };
}

// Handle document insert
function handleDocumentInsert(text: string, params?: any[]): QueryResult<any> {
  // Generate a new ID
  const newId = (Math.max(...sampleData.documents.map(d => parseInt(d.id))) + 1).toString();

  // Create a new document object
  const newDocument: Document = {
    id: newId,
    employee_id: params?.[0] || '1',
    document_type: params?.[1] || 'Other',
    file_name: params?.[2] || 'document.pdf',
    file_path: params?.[3] || `/documents/${params?.[0] || '1'}/document.pdf`,
    mime_type: params?.[4] || 'application/pdf',
    expiry_date: params?.[5] ? new Date(params[5]) : null,
    created_at: new Date(),
    updated_at: new Date()
  };

  // Add to sample data
  sampleData.documents.push(newDocument);

  return {
    rows: [newDocument],
    command: 'INSERT',
    rowCount: 1,
    oid: 0,
    fields: []
  };
}

// Handle employee update
function handleEmployeeUpdate(text: string, params?: any[]): QueryResult<any> {
  const idMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
  if (idMatch && params) {
    const paramIndex = parseInt(idMatch[1]) - 1;
    const id = params[paramIndex];

    // Find the employee
    const employeeIndex = sampleData.employees.findIndex(e => e.id === id);
    if (employeeIndex === -1) {
      return {
        rows: [],
        command: 'UPDATE',
        rowCount: 0,
        oid: 0,
        fields: []
      };
    }

    // Update the employee
    const employee = sampleData.employees[employeeIndex];
    const updatedEmployee = { ...employee, updated_at: new Date() };

    // Extract field names from the query
    const setClause = text.match(/set\s+([^;]+)\s+where/i)?.[1];
    if (setClause) {
      const fieldUpdates = setClause.split(',').map(s => s.trim());

      fieldUpdates.forEach(update => {
        const [field, paramPlaceholder] = update.split('=').map(s => s.trim());
        if (paramPlaceholder.startsWith('$')) {
          const paramIndex = parseInt(paramPlaceholder.substring(1)) - 1;
          if (params && params[paramIndex] !== undefined) {
            const fieldName = field.replace(/"/g, '');
            (updatedEmployee as any)[fieldName] = params[paramIndex];
          }
        }
      });
    }

    // Update in sample data
    sampleData.employees[employeeIndex] = updatedEmployee;

    return {
      rows: [updatedEmployee],
      command: 'UPDATE',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  return {
    rows: [],
    command: 'UPDATE',
    rowCount: 0,
    oid: 0,
    fields: []
  };
}

// Handle company update
function handleCompanyUpdate(text: string, params?: any[]): QueryResult<any> {
  const idMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
  if (idMatch && params) {
    const paramIndex = parseInt(idMatch[1]) - 1;
    const id = params[paramIndex];

    // Find the company
    const companyIndex = sampleData.companies.findIndex(c => c.id === id);
    if (companyIndex === -1) {
      return {
        rows: [],
        command: 'UPDATE',
        rowCount: 0,
        oid: 0,
        fields: []
      };
    }

    // Update the company
    const company = sampleData.companies[companyIndex];
    const updatedCompany = { ...company, updated_at: new Date() };

    // Extract field names from the query
    const setClause = text.match(/set\s+([^;]+)\s+where/i)?.[1];
    if (setClause) {
      const fieldUpdates = setClause.split(',').map(s => s.trim());

      fieldUpdates.forEach(update => {
        const [field, paramPlaceholder] = update.split('=').map(s => s.trim());
        if (paramPlaceholder.startsWith('$')) {
          const paramIndex = parseInt(paramPlaceholder.substring(1)) - 1;
          if (params && params[paramIndex] !== undefined) {
            const fieldName = field.replace(/"/g, '');
            (updatedCompany as any)[fieldName] = params[paramIndex];
          }
        }
      });
    }

    // Update in sample data
    sampleData.companies[companyIndex] = updatedCompany;

    return {
      rows: [updatedCompany],
      command: 'UPDATE',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  return {
    rows: [],
    command: 'UPDATE',
    rowCount: 0,
    oid: 0,
    fields: []
  };
}

// Handle document update
function handleDocumentUpdate(text: string, params?: any[]): QueryResult<any> {
  const idMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
  if (idMatch && params) {
    const paramIndex = parseInt(idMatch[1]) - 1;
    const id = params[paramIndex];

    // Find the document
    const documentIndex = sampleData.documents.findIndex(d => d.id === id);
    if (documentIndex === -1) {
      return {
        rows: [],
        command: 'UPDATE',
        rowCount: 0,
        oid: 0,
        fields: []
      };
    }

    // Update the document
    const document = sampleData.documents[documentIndex];
    const updatedDocument = { ...document, updated_at: new Date() };

    // Extract field names from the query
    const setClause = text.match(/set\s+([^;]+)\s+where/i)?.[1];
    if (setClause) {
      const fieldUpdates = setClause.split(',').map(s => s.trim());

      fieldUpdates.forEach(update => {
        const [field, paramPlaceholder] = update.split('=').map(s => s.trim());
        if (paramPlaceholder.startsWith('$')) {
          const paramIndex = parseInt(paramPlaceholder.substring(1)) - 1;
          if (params && params[paramIndex] !== undefined) {
            const fieldName = field.replace(/"/g, '');
            (updatedDocument as any)[fieldName] = params[paramIndex];
          }
        }
      });
    }

    // Update in sample data
    sampleData.documents[documentIndex] = updatedDocument;

    return {
      rows: [updatedDocument],
      command: 'UPDATE',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  return {
    rows: [],
    command: 'UPDATE',
    rowCount: 0,
    oid: 0,
    fields: []
  };
}

// Handle employee delete
function handleEmployeeDelete(text: string, params?: any[]): QueryResult<any> {
  const idMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
  if (idMatch && params) {
    const paramIndex = parseInt(idMatch[1]) - 1;
    const id = params[paramIndex];

    // Find the employee
    const employeeIndex = sampleData.employees.findIndex(e => e.id === id);
    if (employeeIndex === -1) {
      return {
        rows: [],
        command: 'DELETE',
        rowCount: 0,
        oid: 0,
        fields: []
      };
    }

    // Remove from sample data
    const deletedEmployee = sampleData.employees[employeeIndex];
    sampleData.employees.splice(employeeIndex, 1);

    return {
      rows: [deletedEmployee],
      command: 'DELETE',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  return {
    rows: [],
    command: 'DELETE',
    rowCount: 0,
    oid: 0,
    fields: []
  };
}

// Handle company delete
function handleCompanyDelete(text: string, params?: any[]): QueryResult<any> {
  const idMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
  if (idMatch && params) {
    const paramIndex = parseInt(idMatch[1]) - 1;
    const id = params[paramIndex];

    // Find the company
    const companyIndex = sampleData.companies.findIndex(c => c.id === id);
    if (companyIndex === -1) {
      return {
        rows: [],
        command: 'DELETE',
        rowCount: 0,
        oid: 0,
        fields: []
      };
    }

    // Remove from sample data
    const deletedCompany = sampleData.companies[companyIndex];
    sampleData.companies.splice(companyIndex, 1);

    return {
      rows: [deletedCompany],
      command: 'DELETE',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  return {
    rows: [],
    command: 'DELETE',
    rowCount: 0,
    oid: 0,
    fields: []
  };
}

// Handle document delete
function handleDocumentDelete(text: string, params?: any[]): QueryResult<any> {
  const idMatch = text.match(/where\s+id\s*=\s*\$(\d+)/i);
  if (idMatch && params) {
    const paramIndex = parseInt(idMatch[1]) - 1;
    const id = params[paramIndex];

    // Find the document
    const documentIndex = sampleData.documents.findIndex(d => d.id === id);
    if (documentIndex === -1) {
      return {
        rows: [],
        command: 'DELETE',
        rowCount: 0,
        oid: 0,
        fields: []
      };
    }

    // Remove from sample data
    const deletedDocument = sampleData.documents[documentIndex];
    sampleData.documents.splice(documentIndex, 1);

    return {
      rows: [deletedDocument],
      command: 'DELETE',
      rowCount: 1,
      oid: 0,
      fields: []
    };
  }

  return {
    rows: [],
    command: 'DELETE',
    rowCount: 0,
    oid: 0,
    fields: []
  };
}

// Helper function to extract limit from query
function getQueryLimit(text: string, params?: any[]): number {
  const limitMatch = text.match(/limit\s+\$(\d+)/i);
  if (limitMatch && params) {
    const paramIndex = parseInt(limitMatch[1]) - 1;
    return params[paramIndex] || 20;
  }
  return 20; // Default limit
}

// Helper function to extract offset from query
function getQueryOffset(text: string, params?: any[]): number {
  const offsetMatch = text.match(/offset\s+\$(\d+)/i);
  if (offsetMatch && params) {
    const paramIndex = parseInt(offsetMatch[1]) - 1;
    return params[paramIndex] || 0;
  }
  return 0; // Default offset
}

export default mockDb;
