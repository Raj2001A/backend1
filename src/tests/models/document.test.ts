import { DocumentModel, Document } from '../../models/document';
import db from '../../config/database';

// Mock the database module
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  connect: jest.fn().mockReturnValue({
    query: jest.fn(),
    release: jest.fn(),
  }),
}));

describe('DocumentModel', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all documents', async () => {
      // Mock database response
      const mockResult = {
        rows: [
          {
            id: '1',
            name: 'Passport',
            type: 'PASSPORT_COPY',
            employee_id: '1',
            employee_name: 'John Doe',
            file_id: 'file-id-1',
            file_name: 'passport.pdf',
            file_path: 'documents/1/passport.pdf',
            file_size: 1024000,
            mime_type: 'application/pdf',
            expiry_date: '2028-01-15',
            status: 'active',
            created_at: '2023-01-20',
          },
          {
            id: '2',
            name: 'Visa',
            type: 'VISA_COPY',
            employee_id: '1',
            employee_name: 'John Doe',
            file_id: 'file-id-2',
            file_name: 'visa.pdf',
            file_path: 'documents/1/visa.pdf',
            file_size: 512000,
            mime_type: 'application/pdf',
            expiry_date: '2024-01-15',
            status: 'active',
            created_at: '2023-01-20',
          },
        ],
      };

      // Set up the mock implementation
      (db.query as jest.Mock).mockResolvedValue(mockResult);

      // Call the method
      const result = await DocumentModel.getAll();

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Passport');
      expect(result[1].name).toBe('Visa');
    });

    it('should handle database errors', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(DocumentModel.getAll()).rejects.toThrow('Database error');
    });
  });

  describe('getById', () => {
    it('should return a document by ID', async () => {
      // Mock database response
      const mockResult = {
        rows: [
          {
            id: '1',
            name: 'Passport',
            type: 'PASSPORT_COPY',
            employee_id: '1',
            employee_name: 'John Doe',
            file_id: 'file-id-1',
            file_name: 'passport.pdf',
            file_path: 'documents/1/passport.pdf',
            file_size: 1024000,
            mime_type: 'application/pdf',
            expiry_date: '2028-01-15',
            status: 'active',
            created_at: '2023-01-20',
          },
        ],
      };

      // Set up the mock implementation
      (db.query as jest.Mock).mockResolvedValue(mockResult);

      // Call the method
      const result = await DocumentModel.getById('1');

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Passport');
      expect(result?.type).toBe('PASSPORT_COPY');
    });

    it('should return null if document not found', async () => {
      // Mock empty result
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Call the method
      const result = await DocumentModel.getById('999');

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(DocumentModel.getById('1')).rejects.toThrow('Database error');
    });
  });

  describe('getByEmployeeId', () => {
    it('should return documents by employee ID', async () => {
      // Mock database response
      const mockResult = {
        rows: [
          {
            id: '1',
            name: 'Passport',
            type: 'PASSPORT_COPY',
            employee_id: '1',
            employee_name: 'John Doe',
            file_id: 'file-id-1',
            file_name: 'passport.pdf',
            file_path: 'documents/1/passport.pdf',
            file_size: 1024000,
            mime_type: 'application/pdf',
            expiry_date: '2028-01-15',
            status: 'active',
            created_at: '2023-01-20',
          },
          {
            id: '2',
            name: 'Visa',
            type: 'VISA_COPY',
            employee_id: '1',
            employee_name: 'John Doe',
            file_id: 'file-id-2',
            file_name: 'visa.pdf',
            file_path: 'documents/1/visa.pdf',
            file_size: 512000,
            mime_type: 'application/pdf',
            expiry_date: '2024-01-15',
            status: 'active',
            created_at: '2023-01-20',
          },
        ],
      };

      // Set up the mock implementation
      (db.query as jest.Mock).mockResolvedValue(mockResult);

      // Call the method
      const result = await DocumentModel.getByEmployeeId('1');

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Passport');
      expect(result[1].name).toBe('Visa');
    });

    it('should return empty array if no documents found', async () => {
      // Mock empty result
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Call the method
      const result = await DocumentModel.getByEmployeeId('999');

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(DocumentModel.getByEmployeeId('1')).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    it('should create a new document', async () => {
      // Mock document data
      const documentData: Document = {
        name: 'Emirates ID',
        type: 'EMIRATES_ID',
        employee_id: '1',
        file_id: 'file-id-3',
        file_name: 'emirates-id.pdf',
        file_path: 'documents/1/emirates-id.pdf',
        file_size: 768000,
        mime_type: 'application/pdf',
        expiry_date: new Date('2025-01-15'),
        status: 'active',
      };

      // Mock database responses
      const mockInsertResult = {
        rows: [
          {
            id: '3',
            ...documentData,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      const mockEmployeeResult = {
        rows: [{ name: 'John Doe' }],
      };

      // Set up the mock implementation
      (db.query as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('INSERT INTO documents')) {
          return Promise.resolve(mockInsertResult);
        }
        if (query.includes('SELECT name FROM employees')) {
          return Promise.resolve(mockEmployeeResult);
        }
        return Promise.resolve({ rows: [] });
      });

      // Call the method
      const result = await DocumentModel.create(documentData);

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(result).not.toBeNull();
      expect(result.id).toBe('3');
      expect(result.name).toBe('Emirates ID');
      expect(result.type).toBe('EMIRATES_ID');
      expect(result.employee_name).toBe('John Doe');
    });

    it('should handle database errors', async () => {
      // Mock document data
      const documentData: Document = {
        name: 'Emirates ID',
        type: 'EMIRATES_ID',
        employee_id: '1',
        file_id: 'file-id-3',
        file_name: 'emirates-id.pdf',
        file_path: 'documents/1/emirates-id.pdf',
        file_size: 768000,
        mime_type: 'application/pdf',
        expiry_date: new Date('2025-01-15'),
        status: 'active',
      };

      // Mock database error
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(DocumentModel.create(documentData)).rejects.toThrow('Database error');
    });
  });

  describe('getExpiringDocuments', () => {
    it('should return documents with expiring dates', async () => {
      // Mock database response
      const mockResult = {
        rows: [
          {
            id: '2',
            name: 'Visa',
            type: 'VISA_COPY',
            employee_id: '1',
            employee_name: 'John Doe',
            file_id: 'file-id-2',
            file_name: 'visa.pdf',
            file_path: 'documents/1/visa.pdf',
            file_size: 512000,
            mime_type: 'application/pdf',
            expiry_date: '2024-01-15',
            status: 'active',
            created_at: '2023-01-20',
          },
        ],
      };

      // Set up the mock implementation
      (db.query as jest.Mock).mockResolvedValue(mockResult);

      // Call the method
      const result = await DocumentModel.getExpiringDocuments(30);

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Visa');
      expect(result[0].type).toBe('VISA_COPY');
    });

    it('should return empty array if no expiring documents found', async () => {
      // Mock empty result
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Call the method
      const result = await DocumentModel.getExpiringDocuments(30);

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(DocumentModel.getExpiringDocuments(30)).rejects.toThrow('Database error');
    });
  });
});
