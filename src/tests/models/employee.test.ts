import { EmployeeModel, Employee } from '../../models/employee';
import db from '../../config/database';

// Mock the database module
jest.mock('../../config/database', () => ({
  query: jest.fn(),
  connect: jest.fn().mockReturnValue({
    query: jest.fn(),
    release: jest.fn(),
  }),
}));

describe('EmployeeModel', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all employees with pagination', async () => {
      // Mock database responses
      const mockCountResult = { rows: [{ count: '2' }] };
      const mockEmployeesResult = {
        rows: [
          {
            id: '1',
            employee_id: 'EMP001',
            name: 'John Doe',
            trade: 'Engineer',
            nationality: 'USA',
            join_date: '2023-01-15',
            date_of_birth: '1985-05-20',
            mobile_number: '+1234567890',
            home_phone_number: '+1987654321',
            email: 'john.doe@example.com',
            company_id: '1',
            company_name: 'Cub Technical Services',
          },
          {
            id: '2',
            employee_id: 'EMP002',
            name: 'Jane Smith',
            trade: 'Project Manager',
            nationality: 'UK',
            join_date: '2023-02-10',
            date_of_birth: '1990-08-15',
            mobile_number: '+1234567891',
            home_phone_number: '+1987654322',
            email: 'jane.smith@example.com',
            company_id: '1',
            company_name: 'Cub Technical Services',
          },
        ],
      };

      // Set up the mock implementation
      (db.query as jest.Mock).mockImplementation((query: string) => {
        if (query.includes('COUNT(*)')) {
          return Promise.resolve(mockCountResult);
        }
        return Promise.resolve(mockEmployeesResult);
      });

      // Call the method
      const result = await EmployeeModel.getAll(1, 10);

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(2);
      expect(result.employees.length).toBe(2);
      expect(result.employees[0].name).toBe('John Doe');
      expect(result.employees[1].name).toBe('Jane Smith');
    });

    it('should handle database errors', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(EmployeeModel.getAll()).rejects.toThrow('Database error');
    });
  });

  describe('getById', () => {
    it('should return an employee by ID', async () => {
      // Mock database response
      const mockResult = {
        rows: [
          {
            id: '1',
            employee_id: 'EMP001',
            name: 'John Doe',
            trade: 'Engineer',
            nationality: 'USA',
            join_date: '2023-01-15',
            date_of_birth: '1985-05-20',
            mobile_number: '+1234567890',
            home_phone_number: '+1987654321',
            email: 'john.doe@example.com',
            company_id: '1',
            company_name: 'Cub Technical Services',
          },
        ],
      };

      // Set up the mock implementation
      (db.query as jest.Mock).mockResolvedValue(mockResult);

      // Call the method
      const result = await EmployeeModel.getById('1');

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('John Doe');
      expect(result?.employee_id).toBe('EMP001');
    });

    it('should return null if employee not found', async () => {
      // Mock empty result
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Call the method
      const result = await EmployeeModel.getById('999');

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(EmployeeModel.getById('1')).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    it('should create a new employee', async () => {
      // Mock employee data
      const employeeData: Omit<Employee, 'id'> = {
        employee_id: 'EMP003',
        name: 'Bob Johnson',
        trade: 'Electrician',
        nationality: 'Canada',
        join_date: new Date('2023-03-01'),
        date_of_birth: new Date('1988-11-12'),
        mobile_number: '+1234567892',
        home_phone_number: '+1987654323',
        email: 'bob.johnson@example.com',
        company_id: '1',
        company_name: 'Cub Technical Services',
      };

      // Mock database responses
      const mockInsertResult = {
        rows: [
          {
            id: '3',
            ...employeeData,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      const mockCompanyResult = {
        rows: [{ name: 'Cub Technical Services' }],
      };

      // Set up the mock implementation for client
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('INSERT INTO employees')) {
          return Promise.resolve(mockInsertResult);
        }
        if (query.includes('SELECT name FROM companies')) {
          return Promise.resolve(mockCompanyResult);
        }
        return Promise.resolve({ rows: [] });
      });

      (db.connect as jest.Mock).mockResolvedValue(mockClient);

      // Call the method
      const result = await EmployeeModel.create(employeeData);

      // Assertions
      expect(mockClient.query).toHaveBeenCalledTimes(4); // BEGIN, INSERT, SELECT, COMMIT
      expect(result).not.toBeNull();
      expect(result.id).toBe('3');
      expect(result.name).toBe('Bob Johnson');
      expect(result.employee_id).toBe('EMP003');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors and rollback transaction', async () => {
      // Mock employee data
      const employeeData: Omit<Employee, 'id'> = {
        employee_id: 'EMP003',
        name: 'Bob Johnson',
        trade: 'Electrician',
        nationality: 'Canada',
        join_date: new Date('2023-03-01'),
        date_of_birth: new Date('1988-11-12'),
        mobile_number: '+1234567892',
        home_phone_number: '+1987654323',
        email: 'bob.johnson@example.com',
        company_id: '1',
        company_name: 'Cub Technical Services',
      };

      // Set up the mock implementation for client
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      // Mock database error
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('INSERT INTO employees')) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({ rows: [] });
      });

      (db.connect as jest.Mock).mockResolvedValue(mockClient);

      // Call the method and expect it to throw
      await expect(EmployeeModel.create(employeeData)).rejects.toThrow('Database error');

      // Verify rollback was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should find employees by email', async () => {
      // Mock database response
      const mockResult = {
        rows: [
          {
            id: '1',
            employee_id: 'EMP001',
            name: 'John Doe',
            trade: 'Engineer',
            nationality: 'USA',
            join_date: '2023-01-15',
            date_of_birth: '1985-05-20',
            mobile_number: '+1234567890',
            home_phone_number: '+1987654321',
            email: 'john.doe@example.com',
            company_id: '1',
            company_name: 'Cub Technical Services',
          },
        ],
      };

      // Set up the mock implementation
      (db.query as jest.Mock).mockResolvedValue(mockResult);

      // Call the method
      const result = await EmployeeModel.findByEmail('john.doe@example.com');

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('John Doe');
      expect(result[0].email).toBe('john.doe@example.com');
    });

    it('should return empty array if no employees found', async () => {
      // Mock empty result
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Call the method
      const result = await EmployeeModel.findByEmail('nonexistent@example.com');

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Mock database error
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call the method and expect it to throw
      await expect(EmployeeModel.findByEmail('john.doe@example.com')).rejects.toThrow('Database error');
    });
  });
});
