/**
 * Import Excel Data
 * This script imports employee data from an Excel file into the database
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Get connection string from environment
const connectionString = process.env.NEON_DATABASE_URL;

console.log('Importing Excel data...');
console.log(`Connection string: ${connectionString?.replace(/:[^:]*@/, ':****@')}`);

// Create a new pool with non-strict SSL for development
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Disable SSL validation for development
  }
});

// Default Excel file path (can be overridden by command line argument)
const defaultExcelPath = path.join(__dirname, '../../../employee-data.xlsx');
const excelPath = process.argv[2] || defaultExcelPath;

// Function to import data from Excel
async function importExcelData() {
  let client;
  try {
    // Check if Excel file exists
    if (!fs.existsSync(excelPath)) {
      console.error(`Excel file not found: ${excelPath}`);
      console.log('Please provide a valid Excel file path as an argument:');
      console.log('npm run import-excel-data -- /path/to/your/excel/file.xlsx');
      return;
    }

    console.log(`Reading Excel file: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} records in Excel file`);

    // Connect to database
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('Successfully connected to database!');

    // Begin transaction
    await client.query('BEGIN');

    // Get all companies
    const companiesResult = await client.query('SELECT id, name FROM companies');
    const companies = companiesResult.rows;
    console.log(`Found ${companies.length} companies in database`);

    // Import each employee
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of data) {
      try {
        // Type assertion for row
        const typedRow = row as Record<string, any>;

        // Map Excel columns to database fields
        const employeeId = typedRow['EMPLOYEE ID'] || typedRow['EMPLOYEE_ID'] || typedRow['Employee ID'] || '';
        const name = typedRow['NAME'] || typedRow['Name'] || '';
        const trade = typedRow['TRADE'] || typedRow['Trade'] || '';
        const nationality = typedRow['NATIONALITY'] || typedRow['Nationality'] || '';
        const joinDate = typedRow['JOINING DATE'] || typedRow['JOIN_DATE'] || typedRow['Join Date'] || null;
        const dateOfBirth = typedRow['DATE OF BIRTH'] || typedRow['DATE_OF_BIRTH'] || typedRow['Birth Date'] || null;
        const mobileNumber = typedRow['MOBILE NUMBER'] || typedRow['MOBILE_NUMBER'] || typedRow['Mobile'] || '';
        const homePhoneNumber = typedRow['HOME PHONE NUMBER'] || typedRow['HOME_PHONE_NUMBER'] || typedRow['Home Phone'] || '';
        const email = typedRow['EMAIL ID'] || typedRow['EMAIL'] || typedRow['Email'] || '';
        const companyName = typedRow['COMPANY NAME'] || typedRow['COMPANY_NAME'] || typedRow['Company'] || '';
        const visaExpiryDate = typedRow['VISA EXPIRY DATE'] || typedRow['VISA_EXPIRY_DATE'] || typedRow['Visa Expiry'] || null;

        // Skip if required fields are missing
        if (!employeeId || !name) {
          console.warn(`Skipping row with missing required fields: ${JSON.stringify(row)}`);
          skippedCount++;
          continue;
        }

        // Find company ID
        let companyId = null;
        const company = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
        if (company) {
          companyId = company.id;
        } else if (companyName) {
          // Create new company if it doesn't exist
          console.log(`Creating new company: ${companyName}`);
          const newCompanyResult = await client.query(
            'INSERT INTO companies (name) VALUES ($1) RETURNING id',
            [companyName]
          );
          companyId = newCompanyResult.rows[0].id;
          companies.push({ id: companyId, name: companyName });
        }

        // Check if employee already exists
        const existingEmployeeResult = await client.query(
          'SELECT id FROM employees WHERE employee_id = $1',
          [employeeId]
        );

        if (existingEmployeeResult.rows.length > 0) {
          // Update existing employee
          const employeeId = existingEmployeeResult.rows[0].id;
          await client.query(
            `UPDATE employees SET
              name = $1,
              trade = $2,
              nationality = $3,
              join_date = $4,
              date_of_birth = $5,
              mobile_number = $6,
              home_phone_number = $7,
              email = $8,
              company_id = $9,
              visa_expiry_date = $10,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $11`,
            [
              name,
              trade,
              nationality,
              joinDate ? new Date(joinDate) : null,
              dateOfBirth ? new Date(dateOfBirth) : null,
              mobileNumber,
              homePhoneNumber,
              email,
              companyId,
              visaExpiryDate ? new Date(visaExpiryDate) : null,
              employeeId
            ]
          );
          console.log(`Updated employee: ${name} (${employeeId})`);
        } else {
          // Insert new employee
          await client.query(
            `INSERT INTO employees (
              employee_id, name, trade, nationality, join_date, date_of_birth,
              mobile_number, home_phone_number, email, company_id, visa_expiry_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              employeeId,
              name,
              trade,
              nationality,
              joinDate ? new Date(joinDate) : null,
              dateOfBirth ? new Date(dateOfBirth) : null,
              mobileNumber,
              homePhoneNumber,
              email,
              companyId,
              visaExpiryDate ? new Date(visaExpiryDate) : null
            ]
          );
          console.log(`Inserted new employee: ${name} (${employeeId})`);
        }

        importedCount++;
      } catch (error) {
        console.error(`Error importing row: ${JSON.stringify(row)}`, error);
        errorCount++;
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('Import completed:');
    console.log(`- Imported: ${importedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log(`- Total: ${data.length}`);

  } catch (error) {
    console.error('Error importing Excel data:', error);

    // Rollback transaction if there was an error
    if (client) {
      await client.query('ROLLBACK');
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the import
importExcelData();
