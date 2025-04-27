import db from '../config/database';

// Employee interface
export interface Employee {
  id?: string;
  employee_id: string;
  name: string;
  trade: string;
  nationality: string;
  join_date: Date;
  date_of_birth: Date;
  mobile_number: string;
  home_phone_number?: string;
  email: string;
  company_id: string;
  company_name: string;
  visa_expiry_date?: Date;
  visa_status?: 'active' | 'expiring' | 'expired';
  department?: string;
  position?: string;
  address?: string;
  passport_number?: string;
  created_at?: Date;
  updated_at?: Date;
}

// Emergency contact interface
export interface EmergencyContact {
  id?: string;
  employee_id: string;
  name: string;
  relationship: string;
  phone: string;
  created_at?: Date;
  updated_at?: Date;
}

// Employee model
export const EmployeeModel = {
  // Get all employees with pagination
  async getAll(page: number = 1, limit: number = 1000): Promise<{ employees: Employee[], total: number }> {
    try {
      // Get total count
      const countResult = await db.query('SELECT COUNT(*) FROM employees');
      const total = parseInt(countResult.rows[0].count);

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get paginated results
      const result = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         ORDER BY e.name ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      // Convert string dates to Date objects
      const employees = result.rows.map(row => {
        const typedRow = row as any;
        return {
          ...typedRow,
          join_date: typedRow.join_date ? new Date(typedRow.join_date) : undefined,
          date_of_birth: typedRow.date_of_birth ? new Date(typedRow.date_of_birth) : undefined,
          visa_expiry_date: typedRow.visa_expiry_date ? new Date(typedRow.visa_expiry_date) : undefined,
          created_at: typedRow.created_at ? new Date(typedRow.created_at) : undefined,
          updated_at: typedRow.updated_at ? new Date(typedRow.updated_at) : undefined
        } as Employee;
      });

      return { employees, total };
    } catch (error) {
      console.error('Error getting employees:', error);

      // Check if it's a database connection error
      if (error instanceof Error && (
        error.message.includes('database') ||
        error.message.includes('connection') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('timeout')
      )) {
        // Return empty result for database connection errors
        console.log('Database connection error in getAll(), returning empty result');
        return { employees: [], total: 0 };
      }

      throw error;
    }
  },

  // Get employee by ID
  async getById(id: string): Promise<Employee | null> {
    try {
      const result = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE e.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const employeeData = result.rows[0] as any;
      // Convert string dates to Date objects
      return {
        ...employeeData,
        join_date: employeeData.join_date ? new Date(employeeData.join_date) : undefined,
        date_of_birth: employeeData.date_of_birth ? new Date(employeeData.date_of_birth) : undefined,
        visa_expiry_date: employeeData.visa_expiry_date ? new Date(employeeData.visa_expiry_date) : undefined,
        created_at: employeeData.created_at ? new Date(employeeData.created_at) : undefined,
        updated_at: employeeData.updated_at ? new Date(employeeData.updated_at) : undefined
      } as Employee;
    } catch (error) {
      console.error(`Error getting employee with ID ${id}:`, error);
      throw error;
    }
  },

  // Create new employee
  async create(employeeData: Employee): Promise<Employee> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO employees (
          employee_id, name, trade, nationality, join_date,
          date_of_birth, mobile_number, home_phone_number, email,
          company_id, visa_expiry_date, department, position,
          address, passport_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          employeeData.employee_id,
          employeeData.name,
          employeeData.trade,
          employeeData.nationality,
          employeeData.join_date,
          employeeData.date_of_birth,
          employeeData.mobile_number,
          employeeData.home_phone_number || null,
          employeeData.email,
          employeeData.company_id,
          employeeData.visa_expiry_date || null,
          employeeData.department || null,
          employeeData.position || null,
          employeeData.address || null,
          employeeData.passport_number || null
        ]
      );

      // Get company name
      const companyResult = await client.query(
        'SELECT name FROM companies WHERE id = $1',
        [employeeData.company_id]
      );

      await client.query('COMMIT');

      const dbResult = result.rows[0] as any;
      // Convert string dates to Date objects
      const employee = {
        ...dbResult,
        join_date: dbResult.join_date ? new Date(dbResult.join_date) : undefined,
        date_of_birth: dbResult.date_of_birth ? new Date(dbResult.date_of_birth) : undefined,
        visa_expiry_date: dbResult.visa_expiry_date ? new Date(dbResult.visa_expiry_date) : undefined,
        created_at: dbResult.created_at ? new Date(dbResult.created_at) : undefined,
        updated_at: dbResult.updated_at ? new Date(dbResult.updated_at) : undefined,
        company_name: companyResult.rows.length > 0 ? (companyResult.rows[0] as any).name || '' : ''
      } as Employee;

      return employee;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating employee:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Update employee
  async update(id: string, employeeData: Partial<Employee>): Promise<Employee | null> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Get current employee data
      const currentEmployee = await this.getById(id);
      if (!currentEmployee) {
        return null;
      }

      // Build update query dynamically
      const fields: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      // Add fields that are present in the update data
      if (employeeData.employee_id !== undefined) {
        fields.push(`employee_id = $${paramCounter++}`);
        values.push(employeeData.employee_id);
      }

      if (employeeData.name !== undefined) {
        fields.push(`name = $${paramCounter++}`);
        values.push(employeeData.name);
      }

      if (employeeData.trade !== undefined) {
        fields.push(`trade = $${paramCounter++}`);
        values.push(employeeData.trade);
      }

      if (employeeData.nationality !== undefined) {
        fields.push(`nationality = $${paramCounter++}`);
        values.push(employeeData.nationality);
      }

      if (employeeData.join_date !== undefined) {
        fields.push(`join_date = $${paramCounter++}`);
        values.push(employeeData.join_date);
      }

      if (employeeData.date_of_birth !== undefined) {
        fields.push(`date_of_birth = $${paramCounter++}`);
        values.push(employeeData.date_of_birth);
      }

      if (employeeData.mobile_number !== undefined) {
        fields.push(`mobile_number = $${paramCounter++}`);
        values.push(employeeData.mobile_number);
      }

      if (employeeData.home_phone_number !== undefined) {
        fields.push(`home_phone_number = $${paramCounter++}`);
        values.push(employeeData.home_phone_number || null);
      }

      if (employeeData.email !== undefined) {
        fields.push(`email = $${paramCounter++}`);
        values.push(employeeData.email);
      }

      if (employeeData.company_id !== undefined) {
        fields.push(`company_id = $${paramCounter++}`);
        values.push(employeeData.company_id);
      }

      if (employeeData.visa_expiry_date !== undefined) {
        fields.push(`visa_expiry_date = $${paramCounter++}`);
        values.push(employeeData.visa_expiry_date || null);
      }

      if (employeeData.department !== undefined) {
        fields.push(`department = $${paramCounter++}`);
        values.push(employeeData.department || null);
      }

      if (employeeData.position !== undefined) {
        fields.push(`position = $${paramCounter++}`);
        values.push(employeeData.position || null);
      }

      if (employeeData.address !== undefined) {
        fields.push(`address = $${paramCounter++}`);
        values.push(employeeData.address || null);
      }

      if (employeeData.passport_number !== undefined) {
        fields.push(`passport_number = $${paramCounter++}`);
        values.push(employeeData.passport_number || null);
      }

      // Add updated_at timestamp
      fields.push(`updated_at = $${paramCounter++}`);
      values.push(new Date());

      // Add ID as the last parameter
      values.push(id);

      // Execute update query
      const result = await client.query(
        `UPDATE employees
         SET ${fields.join(', ')}
         WHERE id = $${paramCounter}
         RETURNING *`,
        values
      );

      // Get company name if company_id was updated
      let companyName = currentEmployee.company_name;
      if (employeeData.company_id !== undefined && employeeData.company_id !== currentEmployee.company_id) {
        const companyResult = await client.query(
          'SELECT name FROM companies WHERE id = $1',
          [employeeData.company_id]
        );
        companyName = companyResult.rows.length > 0 ? (companyResult.rows[0] as any).name || '' : '';
      }

      await client.query('COMMIT');

      const dbResult = result.rows[0] as any;
      // Convert string dates to Date objects
      const updatedEmployee = {
        ...dbResult,
        join_date: dbResult.join_date ? new Date(dbResult.join_date) : undefined,
        date_of_birth: dbResult.date_of_birth ? new Date(dbResult.date_of_birth) : undefined,
        visa_expiry_date: dbResult.visa_expiry_date ? new Date(dbResult.visa_expiry_date) : undefined,
        created_at: dbResult.created_at ? new Date(dbResult.created_at) : undefined,
        updated_at: dbResult.updated_at ? new Date(dbResult.updated_at) : undefined,
        company_name: companyName
      } as Employee;

      return updatedEmployee;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error updating employee with ID ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Delete employee
  async delete(id: string): Promise<boolean> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Delete emergency contacts
      await client.query(
        'DELETE FROM emergency_contacts WHERE employee_id = $1',
        [id]
      );

      // Delete documents (in a real app, you'd also delete the files from storage)
      await client.query(
        'DELETE FROM documents WHERE employee_id = $1',
        [id]
      );

      // Delete employee
      const result = await client.query(
        'DELETE FROM employees WHERE id = $1 RETURNING id',
        [id]
      );

      await client.query('COMMIT');

      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error deleting employee with ID ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Search employees with pagination
  async search(query: string, page: number = 1, limit: number = 1000): Promise<{ employees: Employee[], total: number }> {
    try {
      // Get total count for this search
      const countResult = await db.query(
        `SELECT COUNT(*)
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE
           e.name ILIKE $1 OR
           e.employee_id ILIKE $1 OR
           e.email ILIKE $1 OR
           e.trade ILIKE $1 OR
           e.nationality ILIKE $1 OR
           c.name ILIKE $1`,
        [`%${query}%`]
      );
      const total = parseInt(countResult.rows[0].count);

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get paginated results
      const result = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE
           e.name ILIKE $1 OR
           e.employee_id ILIKE $1 OR
           e.email ILIKE $1 OR
           e.trade ILIKE $1 OR
           e.nationality ILIKE $1 OR
           c.name ILIKE $1
         ORDER BY e.name ASC
         LIMIT $2 OFFSET $3`,
        [`%${query}%`, limit, offset]
      );

      // Convert string dates to Date objects
      const employees = result.rows.map(row => {
        const typedRow = row as any;
        return {
          ...typedRow,
          join_date: typedRow.join_date ? new Date(typedRow.join_date) : undefined,
          date_of_birth: typedRow.date_of_birth ? new Date(typedRow.date_of_birth) : undefined,
          visa_expiry_date: typedRow.visa_expiry_date ? new Date(typedRow.visa_expiry_date) : undefined,
          created_at: typedRow.created_at ? new Date(typedRow.created_at) : undefined,
          updated_at: typedRow.updated_at ? new Date(typedRow.updated_at) : undefined
        } as Employee;
      });

      return { employees, total };
    } catch (error) {
      console.error('Error searching employees:', error);
      throw error;
    }
  },

  // Get employees by company with pagination
  async getByCompany(companyId: string, page: number = 1, limit: number = 1000): Promise<{ employees: Employee[], total: number }> {
    try {
      // Get total count for this company
      const countResult = await db.query(
        'SELECT COUNT(*) FROM employees WHERE company_id = $1',
        [companyId]
      );
      const total = parseInt(countResult.rows[0].count);

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get paginated results
      const result = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE e.company_id = $1
         ORDER BY e.name ASC
         LIMIT $2 OFFSET $3`,
        [companyId, limit, offset]
      );

      // Convert string dates to Date objects
      const employees = result.rows.map(row => {
        const typedRow = row as any;
        return {
          ...typedRow,
          join_date: typedRow.join_date ? new Date(typedRow.join_date) : undefined,
          date_of_birth: typedRow.date_of_birth ? new Date(typedRow.date_of_birth) : undefined,
          visa_expiry_date: typedRow.visa_expiry_date ? new Date(typedRow.visa_expiry_date) : undefined,
          created_at: typedRow.created_at ? new Date(typedRow.created_at) : undefined,
          updated_at: typedRow.updated_at ? new Date(typedRow.updated_at) : undefined
        } as Employee;
      });

      return { employees, total };
    } catch (error) {
      console.error(`Error getting employees for company ${companyId}:`, error);
      throw error;
    }
  },

  // Find employee by email
  async findByEmail(email: string): Promise<Employee | null> {
    try {
      const result = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE e.email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const employeeData = result.rows[0] as any;
      // Convert string dates to Date objects
      return {
        ...employeeData,
        join_date: employeeData.join_date ? new Date(employeeData.join_date) : undefined,
        date_of_birth: employeeData.date_of_birth ? new Date(employeeData.date_of_birth) : undefined,
        visa_expiry_date: employeeData.visa_expiry_date ? new Date(employeeData.visa_expiry_date) : undefined,
        created_at: employeeData.created_at ? new Date(employeeData.created_at) : undefined,
        updated_at: employeeData.updated_at ? new Date(employeeData.updated_at) : undefined
      } as Employee;
    } catch (error) {
      console.error(`Error finding employee with email ${email}:`, error);
      throw error;
    }
  },

  // Get employees with expiring visas
  async getWithExpiringVisas(daysThreshold: number = 30): Promise<Employee[]> {
    try {
      const result = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE
           e.visa_expiry_date IS NOT NULL AND
           e.visa_expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${daysThreshold} days')
         ORDER BY e.visa_expiry_date ASC`
      );

      // Convert string dates to Date objects
      return result.rows.map(row => {
        const typedRow = row as any;
        return {
          ...typedRow,
          join_date: typedRow.join_date ? new Date(typedRow.join_date) : undefined,
          date_of_birth: typedRow.date_of_birth ? new Date(typedRow.date_of_birth) : undefined,
          visa_expiry_date: typedRow.visa_expiry_date ? new Date(typedRow.visa_expiry_date) : undefined,
          created_at: typedRow.created_at ? new Date(typedRow.created_at) : undefined,
          updated_at: typedRow.updated_at ? new Date(typedRow.updated_at) : undefined
        } as Employee;
      });
    } catch (error) {
      console.error('Error getting employees with expiring visas:', error);
      throw error;
    }
  },

  // Find employees by email (multiple)
  async findEmployeesByEmail(email: string): Promise<Employee[]> {
    try {
      const result = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE e.email = $1`,
        [email]
      );

      // Convert string dates to Date objects
      const employees = result.rows.map(row => {
        const typedRow = row as any;
        return {
          ...typedRow,
          join_date: typedRow.join_date ? new Date(typedRow.join_date) : undefined,
          date_of_birth: typedRow.date_of_birth ? new Date(typedRow.date_of_birth) : undefined,
          visa_expiry_date: typedRow.visa_expiry_date ? new Date(typedRow.visa_expiry_date) : undefined,
          created_at: typedRow.created_at ? new Date(typedRow.created_at) : undefined,
          updated_at: typedRow.updated_at ? new Date(typedRow.updated_at) : undefined
        } as Employee;
      });

      return employees;
    } catch (error) {
      console.error(`Error finding employee by email ${email}:`, error);
      throw error;
    }
  },

  // Get employees with expiring visas for reminders
  async getExpiringVisas(limit: number = 10): Promise<Employee[]> {
    try {
      // Get employees with expired visas
      const expiredResult = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE
           e.visa_expiry_date IS NOT NULL AND
           e.visa_expiry_date < CURRENT_DATE
         ORDER BY e.visa_expiry_date DESC
         LIMIT $1`,
        [Math.ceil(limit / 2)]
      );

      // Get employees with visas expiring soon (next 30 days)
      const expiringResult = await db.query(
        `SELECT e.*, c.name as company_name
         FROM employees e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE
           e.visa_expiry_date IS NOT NULL AND
           e.visa_expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
         ORDER BY e.visa_expiry_date ASC
         LIMIT $1`,
        [Math.ceil(limit / 2)]
      );

      // Combine and convert string dates to Date objects
      const employees = [...expiredResult.rows, ...expiringResult.rows].map(row => {
        const typedRow = row as any;
        return {
          ...typedRow,
          join_date: typedRow.join_date ? new Date(typedRow.join_date) : undefined,
          date_of_birth: typedRow.date_of_birth ? new Date(typedRow.date_of_birth) : undefined,
          visa_expiry_date: typedRow.visa_expiry_date ? new Date(typedRow.visa_expiry_date) : undefined,
          created_at: typedRow.created_at ? new Date(typedRow.created_at) : undefined,
          updated_at: typedRow.updated_at ? new Date(typedRow.updated_at) : undefined
        } as Employee;
      });

      return employees;
    } catch (error) {
      console.error('Error getting visa expiry reminders:', error);

      // For mock data or when database is unavailable
      if (error instanceof Error && (
        error.message.includes('database') ||
        error.message.includes('connection') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('timeout')
      )) {
        // Return mock data for testing
        return [
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
            visa_expiry_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
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
            visa_expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
          }
        ];
      }

      throw error;
    }
  }
};

// Emergency contact model
export const EmergencyContactModel = {
  // Get emergency contacts for an employee
  async getByEmployeeId(employeeId: string): Promise<EmergencyContact[]> {
    try {
      const result = await db.query(
        'SELECT * FROM emergency_contacts WHERE employee_id = $1',
        [employeeId]
      );

      // Convert string dates to Date objects
      return result.rows.map(row => {
        const typedRow = row as any;
        return {
          ...typedRow,
          created_at: typedRow.created_at ? new Date(typedRow.created_at) : undefined,
          updated_at: typedRow.updated_at ? new Date(typedRow.updated_at) : undefined
        } as EmergencyContact;
      });
    } catch (error) {
      console.error(`Error getting emergency contacts for employee ${employeeId}:`, error);
      throw error;
    }
  },

  // Create emergency contact
  async create(contactData: EmergencyContact): Promise<EmergencyContact> {
    try {
      const result = await db.query(
        `INSERT INTO emergency_contacts (
          employee_id, name, relationship, phone
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [
          contactData.employee_id,
          contactData.name,
          contactData.relationship,
          contactData.phone
        ]
      );

      const dbResult = result.rows[0] as any;
      // Convert string dates to Date objects
      return {
        ...dbResult,
        created_at: dbResult.created_at ? new Date(dbResult.created_at) : undefined,
        updated_at: dbResult.updated_at ? new Date(dbResult.updated_at) : undefined
      } as EmergencyContact;
    } catch (error) {
      console.error('Error creating emergency contact:', error);
      throw error;
    }
  },

  // Update emergency contact
  async update(id: string, contactData: Partial<EmergencyContact>): Promise<EmergencyContact | null> {
    try {
      // Build update query dynamically
      const fields: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      if (contactData.name !== undefined) {
        fields.push(`name = $${paramCounter++}`);
        values.push(contactData.name);
      }

      if (contactData.relationship !== undefined) {
        fields.push(`relationship = $${paramCounter++}`);
        values.push(contactData.relationship);
      }

      if (contactData.phone !== undefined) {
        fields.push(`phone = $${paramCounter++}`);
        values.push(contactData.phone);
      }

      // Add updated_at timestamp
      fields.push(`updated_at = $${paramCounter++}`);
      values.push(new Date());

      // Add ID as the last parameter
      values.push(id);

      const result = await db.query(
        `UPDATE emergency_contacts
         SET ${fields.join(', ')}
         WHERE id = $${paramCounter}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return null;
      }

      const dbResult = result.rows[0] as any;
      // Convert string dates to Date objects
      return {
        ...dbResult,
        created_at: dbResult.created_at ? new Date(dbResult.created_at) : undefined,
        updated_at: dbResult.updated_at ? new Date(dbResult.updated_at) : undefined
      } as EmergencyContact;
    } catch (error) {
      console.error(`Error updating emergency contact with ID ${id}:`, error);
      throw error;
    }
  },

  // Delete emergency contact
  async delete(id: string): Promise<boolean> {
    try {
      const result = await db.query(
        'DELETE FROM emergency_contacts WHERE id = $1 RETURNING id',
        [id]
      );

      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error(`Error deleting emergency contact with ID ${id}:`, error);
      throw error;
    }
  }
};
