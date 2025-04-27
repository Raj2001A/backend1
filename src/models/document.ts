import db from '../config/database';

// Document interface
export interface Document {
  id?: string;
  name: string;
  type: string;
  employee_id: string;
  file_id?: string;
  file_name?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  expiry_date?: Date;
  notes?: string;
  status?: string;
  created_at?: Date;
  updated_at?: Date;
  employee_name?: string; // Added for join queries
}

// Document model
export const DocumentModel = {
  // Get all documents
  async getAll(): Promise<Document[]> {
    try {
      const result = await db.query(
        `SELECT d.*, e.name as employee_name
         FROM documents d
         LEFT JOIN employees e ON d.employee_id = e.id
         ORDER BY d.created_at DESC`
      );
      return result.rows as unknown as Document[];
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  },

  // Get document by ID
  async getById(id: string): Promise<Document | null> {
    try {
      const result = await db.query(
        `SELECT d.*, e.name as employee_name
         FROM documents d
         LEFT JOIN employees e ON d.employee_id = e.id
         WHERE d.id = $1`,
        [id]
      );

      return result.rows.length > 0 ? (result.rows[0] as unknown as Document) : null;
    } catch (error) {
      console.error(`Error getting document with ID ${id}:`, error);
      throw error;
    }
  },

  // Get documents by employee ID
  async getByEmployeeId(employeeId: string): Promise<Document[]> {
    try {
      const result = await db.query(
        `SELECT d.*, e.name as employee_name
         FROM documents d
         LEFT JOIN employees e ON d.employee_id = e.id
         WHERE d.employee_id = $1
         ORDER BY d.created_at DESC`,
        [employeeId]
      );

      return result.rows as unknown as Document[];
    } catch (error) {
      console.error(`Error getting documents for employee ${employeeId}:`, error);
      throw error;
    }
  },

  // Get documents by type
  async getByType(type: string): Promise<Document[]> {
    try {
      const result = await db.query(
        `SELECT d.*, e.name as employee_name
         FROM documents d
         LEFT JOIN employees e ON d.employee_id = e.id
         WHERE d.type = $1
         ORDER BY d.created_at DESC`,
        [type]
      );

      return result.rows as unknown as Document[];
    } catch (error) {
      console.error(`Error getting documents of type ${type}:`, error);
      throw error;
    }
  },

  // Create new document
  async create(document: Document): Promise<Document> {
    try {
      const result = await db.query(
        `INSERT INTO documents (
          name, type, employee_id, file_id, file_name,
          file_path, file_size, mime_type, expiry_date, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          document.name,
          document.type,
          document.employee_id,
          document.file_id || null,
          document.file_name || null,
          document.file_path || null,
          document.file_size || null,
          document.mime_type || null,
          document.expiry_date || null,
          document.notes || null,
          document.status || 'active'
        ]
      );

      // Get employee name
      const employeeResult = await db.query(
        'SELECT name FROM employees WHERE id = $1',
        [document.employee_id]
      );

      const newDocument = result.rows[0] as unknown as Document;
      if (employeeResult.rows.length > 0) {
        const employeeName = employeeResult.rows[0] as unknown as { name: string };
        newDocument.employee_name = employeeName.name || '';
      } else {
        newDocument.employee_name = '';
      }

      return newDocument;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  },

  // Update document
  async update(id: string, document: Partial<Document>): Promise<Document | null> {
    try {
      // Build update query dynamically
      const fields: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      if (document.name !== undefined) {
        fields.push(`name = $${paramCounter++}`);
        values.push(document.name);
      }

      if (document.type !== undefined) {
        fields.push(`type = $${paramCounter++}`);
        values.push(document.type);
      }

      if (document.employee_id !== undefined) {
        fields.push(`employee_id = $${paramCounter++}`);
        values.push(document.employee_id);
      }

      if (document.file_id !== undefined) {
        fields.push(`file_id = $${paramCounter++}`);
        values.push(document.file_id || null);
      }

      if (document.file_name !== undefined) {
        fields.push(`file_name = $${paramCounter++}`);
        values.push(document.file_name || null);
      }

      if (document.file_path !== undefined) {
        fields.push(`file_path = $${paramCounter++}`);
        values.push(document.file_path || null);
      }

      if (document.file_size !== undefined) {
        fields.push(`file_size = $${paramCounter++}`);
        values.push(document.file_size || null);
      }

      if (document.mime_type !== undefined) {
        fields.push(`mime_type = $${paramCounter++}`);
        values.push(document.mime_type || null);
      }

      if (document.expiry_date !== undefined) {
        fields.push(`expiry_date = $${paramCounter++}`);
        values.push(document.expiry_date || null);
      }

      if (document.notes !== undefined) {
        fields.push(`notes = $${paramCounter++}`);
        values.push(document.notes || null);
      }

      if (document.status !== undefined) {
        fields.push(`status = $${paramCounter++}`);
        values.push(document.status);
      }

      // Add updated_at timestamp
      fields.push(`updated_at = $${paramCounter++}`);
      values.push(new Date());

      // Add ID as the last parameter
      values.push(id);

      const result = await db.query(
        `UPDATE documents
         SET ${fields.join(', ')}
         WHERE id = $${paramCounter}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Get employee name if employee_id was updated
      if (document.employee_id !== undefined) {
        const employeeResult = await db.query(
          'SELECT name FROM employees WHERE id = $1',
          [document.employee_id]
        );

        const updatedDoc = result.rows[0] as unknown as Document;
        if (employeeResult.rows.length > 0) {
          const employeeName = employeeResult.rows[0] as unknown as { name: string };
          updatedDoc.employee_name = employeeName.name || '';
        } else {
          updatedDoc.employee_name = '';
        }
      }

      return result.rows[0] as unknown as Document;
    } catch (error) {
      console.error(`Error updating document with ID ${id}:`, error);
      throw error;
    }
  },

  // Delete document
  async delete(id: string): Promise<boolean> {
    try {
      // In a real app, you'd also delete the file from storage
      const result = await db.query(
        'DELETE FROM documents WHERE id = $1 RETURNING id',
        [id]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting document with ID ${id}:`, error);
      throw error;
    }
  },

  // Get documents with expiring dates
  async getExpiringDocuments(daysThreshold: number = 30): Promise<Document[]> {
    try {
      const result = await db.query(
        `SELECT d.*, e.name as employee_name
         FROM documents d
         LEFT JOIN employees e ON d.employee_id = e.id
         WHERE
           d.expiry_date IS NOT NULL AND
           d.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${daysThreshold} days')
         ORDER BY d.expiry_date ASC`
      );

      return result.rows as unknown as Document[];
    } catch (error) {
      console.error('Error getting expiring documents:', error);
      throw error;
    }
  },

  // Search documents
  async search(query: string): Promise<Document[]> {
    try {
      const result = await db.query(
        `SELECT d.*, e.name as employee_name
         FROM documents d
         LEFT JOIN employees e ON d.employee_id = e.id
         WHERE
           d.name ILIKE $1 OR
           d.type ILIKE $1 OR
           e.name ILIKE $1 OR
           d.notes ILIKE $1
         ORDER BY d.created_at DESC`,
        [`%${query}%`]
      );

      return result.rows as unknown as Document[];
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }
};
