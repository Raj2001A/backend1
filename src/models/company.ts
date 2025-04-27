import db from '../config/database';

// Company interface
export interface Company {
  id?: string;
  name: string;
  location?: string;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

// Company model
export const CompanyModel = {
  // Get all companies
  async getAll(): Promise<Company[]> {
    try {
      const result = await db.query(
        'SELECT * FROM companies ORDER BY name ASC'
      );
      return result.rows as Company[];
    } catch (error) {
      console.error('Error getting companies:', error);
      throw error;
    }
  },

  // Get company by ID
  async getById(id: string): Promise<Company | null> {
    try {
      const result = await db.query(
        'SELECT * FROM companies WHERE id = $1',
        [id]
      );

      return result.rows.length > 0 ? (result.rows[0] as Company) : null;
    } catch (error) {
      console.error(`Error getting company with ID ${id}:`, error);
      throw error;
    }
  },

  // Create new company
  async create(company: Company): Promise<Company> {
    try {
      const result = await db.query(
        `INSERT INTO companies (
          name, location, description
        ) VALUES ($1, $2, $3)
        RETURNING *`,
        [
          company.name,
          company.location || null,
          company.description || null
        ]
      );

      return result.rows[0] as Company;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  },

  // Update company
  async update(id: string, company: Partial<Company>): Promise<Company | null> {
    try {
      // Build update query dynamically
      const fields: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      if (company.name !== undefined) {
        fields.push(`name = $${paramCounter++}`);
        values.push(company.name);
      }

      if (company.location !== undefined) {
        fields.push(`location = $${paramCounter++}`);
        values.push(company.location || null);
      }

      if (company.description !== undefined) {
        fields.push(`description = $${paramCounter++}`);
        values.push(company.description || null);
      }

      // Add updated_at timestamp
      fields.push(`updated_at = $${paramCounter++}`);
      values.push(new Date());

      // Add ID as the last parameter
      values.push(id);

      const result = await db.query(
        `UPDATE companies
         SET ${fields.join(', ')}
         WHERE id = $${paramCounter}
         RETURNING *`,
        values
      );

      return result.rows.length > 0 ? (result.rows[0] as Company) : null;
    } catch (error) {
      console.error(`Error updating company with ID ${id}:`, error);
      throw error;
    }
  },

  // Delete company
  async delete(id: string): Promise<boolean> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Check if company has employees
      const employeeCheck = await client.query(
        'SELECT COUNT(*) FROM employees WHERE company_id = $1',
        [id]
      );

      if (parseInt(employeeCheck.rows[0].count as string) > 0) {
        throw new Error('Cannot delete company with associated employees');
      }

      // Delete company
      const result = await client.query(
        'DELETE FROM companies WHERE id = $1 RETURNING id',
        [id]
      );

      await client.query('COMMIT');

      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error deleting company with ID ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Get company with employee count
  async getAllWithEmployeeCount(): Promise<any[]> {
    try {
      const result = await db.query(
        `SELECT c.*, COUNT(e.id) as employee_count
         FROM companies c
         LEFT JOIN employees e ON c.id = e.company_id
         GROUP BY c.id
         ORDER BY c.name ASC`
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting companies with employee count:', error);
      throw error;
    }
  }
};










