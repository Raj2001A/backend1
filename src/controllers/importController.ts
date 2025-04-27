import { Request, Response, NextFunction } from 'express';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { EmployeeModel, Employee } from '../models/employee';
import db from '../config/database';
import { ApiError } from '../middleware/error';

// Function to convert Excel date to PostgreSQL date format
function formatDate(excelDate: any): string | null {
  if (!excelDate) return null;

  let date;

  // Handle Excel serial date numbers
  if (typeof excelDate === 'number') {
    // Excel dates are number of days since 1900-01-01 (except for the leap year bug)
    date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  } else if (typeof excelDate === 'string') {
    // Try to parse date string
    const parts = excelDate.split(/[\/\-]/);
    if (parts.length === 3) {
      // Assume MM/DD/YYYY or DD-MM-YYYY format
      // Try both formats
      const m = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);

      // Handle 2-digit years
      if (y < 100) {
        y += y < 50 ? 2000 : 1900;
      }

      date = new Date(y, m - 1, d);

      // If invalid, try the other format (DD/MM/YYYY)
      if (isNaN(date.getTime())) {
        date = new Date(y, d - 1, m);
      }
    } else {
      // Try standard date parsing
      date = new Date(excelDate);
    }
  } else {
    // If it's already a Date object
    date = excelDate;
  }

  // Check if date is valid
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  return null;
}

// Function to sanitize text fields
function sanitizeText(text: any): string | null {
  if (text === null || text === undefined) return null;
  return String(text).trim();
}

export const importEmployees = async (req: Request, res: Response, next: NextFunction) => {
  // Check if file was uploaded
  if (!req.file) {
    return next(new ApiError('No file uploaded', 400));
  }

  // Check file type
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  if (fileExtension !== '.xlsx' && fileExtension !== '.xls') {
    return next(new ApiError('Only Excel files (.xlsx, .xls) are allowed', 400));
  }

  const client = await db.connect();

  try {
    // Read the Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return next(new ApiError('Excel file is empty', 400));
    }

    // Get company IDs
    const companyRes = await client.query('SELECT id, name FROM companies');
    const companies = companyRes.rows;

    // Create a map of company name to ID
    const companyMap: { [key: string]: string } = {};
    companies.forEach(company => {
      companyMap[company.name.toLowerCase()] = company.id;
    });

    // Default company ID (use the first company if no match is found)
    const defaultCompanyId = companies[0]?.id;

    if (!defaultCompanyId) {
      return next(new ApiError('No companies found in the database', 500));
    }

    // Start a transaction
    await client.query('BEGIN');

    // Import each row
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const importedEmployees: Employee[] = [];

    for (const [index, row] of data.entries()) {
      // Type assertion for row
      const typedRow = row as Record<string, any>;
      try {
        // Extract and sanitize data from the Excel row based on your exact column structure
        // EMPLOYEE ID	NAME	TRADE	NATIONALITY	JOINING DATE	DATE OF BIRTH	MOBILE NUMBER	HOME PHONE NUMBER	EMAIL ID	COMPANY ID	COMPANY NAME
        const employeeData: any = {
          employee_id: sanitizeText(typedRow['EMPLOYEE ID'] || `EMP${1000 + index}`),
          name: sanitizeText(typedRow['NAME'] || ''),
          trade: sanitizeText(typedRow['TRADE'] || ''),
          nationality: sanitizeText(typedRow['NATIONALITY'] || ''),
          join_date: formatDate(typedRow['JOINING DATE'] || new Date()),
          date_of_birth: formatDate(typedRow['DATE OF BIRTH'] || null),
          mobile_number: sanitizeText(typedRow['MOBILE NUMBER'] || ''),
          home_phone_number: sanitizeText(typedRow['HOME PHONE NUMBER'] || null),
          email: sanitizeText(typedRow['EMAIL ID'] || `${sanitizeText(typedRow['NAME'])?.replace(/\s+/g, '.').toLowerCase() || 'employee'}@cubstechnical.com`),
          company_id: null, // We'll handle this separately based on COMPANY ID and COMPANY NAME
          visa_expiry_date: formatDate(typedRow['VISA EXPIRY DATE'] || null),
          department: sanitizeText(typedRow['DEPARTMENT'] || null),
          position: sanitizeText(typedRow['POSITION'] || null),
          address: sanitizeText(typedRow['ADDRESS'] || null),
          passport_number: sanitizeText(typedRow['PASSPORT NUMBER'] || null)
        };

        // Handle company assignment based on COMPANY ID and COMPANY NAME
        if (typedRow['COMPANY ID'] && !isNaN(parseInt(String(typedRow['COMPANY ID'])))) {
          // If we have a numeric COMPANY ID, try to find the corresponding company
          const companyIndex = parseInt(String(typedRow['COMPANY ID'])) - 1; // Assuming 1-based indexing
          if (companyIndex >= 0 && companyIndex < companies.length) {
            employeeData.company_id = companies[companyIndex].id;
          } else {
            employeeData.company_id = defaultCompanyId;
          }
        } else if (typedRow['COMPANY NAME']) {
          // Try to match by company name
          const companyName = String(typedRow['COMPANY NAME']).toLowerCase();
          // Try different variations of the company name
          const possibleNames = [
            companyName,
            companyName.replace(/,.*$/, ''), // Remove everything after comma
            companyName.split(',')[0].trim() // Take first part before comma
          ];

          // Try to find a match
          let found = false;
          for (const name of possibleNames) {
            if (companyMap[name]) {
              employeeData.company_id = companyMap[name];
              found = true;
              break;
            }
          }

          if (!found) {
            employeeData.company_id = defaultCompanyId;
          }
        } else {
          employeeData.company_id = defaultCompanyId;
        }

        // Ensure required fields have values
        if (!employeeData.name) {
          throw new Error(`Row ${index + 1}: Employee name is required`);
        }

        if (!employeeData.trade) {
          employeeData.trade = 'Not Specified';
        }

        if (!employeeData.nationality) {
          employeeData.nationality = 'Not Specified';
        }

        if (!employeeData.mobile_number) {
          employeeData.mobile_number = 'Not Provided';
        }

        // Insert employee data
        const result = await client.query(
          `INSERT INTO employees (
            employee_id, name, trade, nationality, join_date,
            date_of_birth, mobile_number, home_phone_number, email,
            company_id, visa_expiry_date, department, position,
            address, passport_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id, name, employee_id, company_id`,
          [
            employeeData.employee_id,
            employeeData.name,
            employeeData.trade,
            employeeData.nationality,
            employeeData.join_date,
            employeeData.date_of_birth,
            employeeData.mobile_number,
            employeeData.home_phone_number,
            employeeData.email,
            employeeData.company_id,
            employeeData.visa_expiry_date,
            employeeData.department,
            employeeData.position,
            employeeData.address,
            employeeData.passport_number
          ]
        );

        // Get company name
        const companyResult = await client.query(
          'SELECT name FROM companies WHERE id = $1',
          [employeeData.company_id]
        );

        const companyName = companyResult.rows.length > 0 ? companyResult.rows[0].name : '';

        // Add to imported employees list
        importedEmployees.push({
          ...result.rows[0],
          company_name: companyName,
          employee_id: employeeData.employee_id,
          name: employeeData.name,
          trade: employeeData.trade,
          nationality: employeeData.nationality,
          join_date: new Date(employeeData.join_date),
          date_of_birth: employeeData.date_of_birth ? new Date(employeeData.date_of_birth) : undefined,
          mobile_number: employeeData.mobile_number,
          home_phone_number: employeeData.home_phone_number,
          email: employeeData.email,
          company_id: employeeData.company_id
        } as Employee);

        // If there's emergency contact information, add it
        if (typedRow['Emergency Contact Name'] || typedRow['Emergency Contact Phone']) {
          const emergencyContactData = {
            employee_id: result.rows[0].id,
            name: sanitizeText(typedRow['Emergency Contact Name'] || 'Not Provided'),
            relationship: sanitizeText(typedRow['Emergency Contact Relationship'] || 'Not Specified'),
            phone: sanitizeText(typedRow['Emergency Contact Phone'] || 'Not Provided')
          };

          await client.query(
            `INSERT INTO emergency_contacts (
              employee_id, name, relationship, phone
            ) VALUES ($1, $2, $3, $4)`,
            [
              emergencyContactData.employee_id,
              emergencyContactData.name,
              emergencyContactData.relationship,
              emergencyContactData.phone
            ]
          );
        }

        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${index + 1}: ${errorMessage}`);
      }
    }

    // Commit the transaction
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Import completed: ${successCount} successful, ${errorCount} failed`,
      data: {
        successCount,
        errorCount,
        errors,
        importedEmployees
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

export const getImportTemplate = (req: Request, res: Response) => {
  // Create a template workbook
  const workbook = xlsx.utils.book_new();

  // Define the headers
  const headers = [
    'EMPLOYEE ID', 'NAME', 'TRADE', 'NATIONALITY', 'JOINING DATE', 'DATE OF BIRTH',
    'MOBILE NUMBER', 'HOME PHONE NUMBER', 'EMAIL ID', 'COMPANY ID', 'COMPANY NAME',
    'VISA EXPIRY DATE', 'DEPARTMENT', 'POSITION', 'ADDRESS', 'PASSPORT NUMBER',
    'Emergency Contact Name', 'Emergency Contact Relationship', 'Emergency Contact Phone'
  ];

  // Create sample data
  const sampleData = [
    {
      'EMPLOYEE ID': 'EMP001',
      'NAME': 'John Smith',
      'TRADE': 'Carpenter',
      'NATIONALITY': 'British',
      'JOINING DATE': '2023-01-15',
      'DATE OF BIRTH': '1985-06-22',
      'MOBILE NUMBER': '+971501234567',
      'HOME PHONE NUMBER': '+971561234567',
      'EMAIL ID': 'john.smith@cubstechnical.com',
      'COMPANY ID': '1',
      'COMPANY NAME': 'CUBS TECH CONTRACTING, SHARJAH, UAE',
      'VISA EXPIRY DATE': '2025-01-15',
      'DEPARTMENT': 'Construction',
      'POSITION': 'Senior Carpenter',
      'ADDRESS': 'Sharjah, UAE',
      'PASSPORT NUMBER': 'AB123456',
      'Emergency Contact Name': 'Jane Smith',
      'Emergency Contact Relationship': 'Spouse',
      'Emergency Contact Phone': '+971502345678'
    },
    {
      'EMPLOYEE ID': 'EMP002',
      'NAME': 'Ahmed Hassan',
      'TRADE': 'Electrician',
      'NATIONALITY': 'Egyptian',
      'JOINING DATE': '2023-02-20',
      'DATE OF BIRTH': '1990-03-15',
      'MOBILE NUMBER': '+971502345678',
      'HOME PHONE NUMBER': '',
      'EMAIL ID': 'ahmed.hassan@cubstechnical.com',
      'COMPANY ID': '2',
      'COMPANY NAME': 'CUBS TECHNICAL SERVICES, ABU DHABI, UAE',
      'VISA EXPIRY DATE': '2025-02-20',
      'DEPARTMENT': 'Electrical',
      'POSITION': 'Electrician',
      'ADDRESS': 'Abu Dhabi, UAE',
      'PASSPORT NUMBER': 'CD789012',
      'Emergency Contact Name': 'Fatima Hassan',
      'Emergency Contact Relationship': 'Spouse',
      'Emergency Contact Phone': '+971503456789'
    }
  ];

  // Create worksheet
  const worksheet = xlsx.utils.json_to_sheet(sampleData);

  // Add worksheet to workbook
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Employees');

  // Generate buffer
  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Set headers for file download
  res.setHeader('Content-Disposition', 'attachment; filename=employee_import_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  // Send the file
  res.send(buffer);
};
