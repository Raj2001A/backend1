const xlsx = require('xlsx');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Use the connection string from environment variable
const connectionString = process.env.NEON_DATABASE_URL || process.env.EXPO_PUBLIC_NEON_URL;

console.log('Using connection string:', connectionString);

// Create a new PostgreSQL connection pool
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Neon PostgreSQL
  },
  // Add connection timeout
  connectionTimeoutMillis: 10000,
  // Add idle timeout
  idleTimeoutMillis: 30000,
  // Add max clients
  max: 10
});

// Function to convert Excel date to PostgreSQL date format
function formatDate(excelDate) {
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
function sanitizeText(text) {
  if (text === null || text === undefined) return null;
  return String(text).trim();
}

async function importExcelData() {
  try {
    console.log('Connecting to Neon PostgreSQL database...');

    // Test the connection
    const client = await pool.connect();
    console.log('Connected to Neon PostgreSQL database successfully!');

    // Path to your Excel file - update this to your actual file path
    const excelFilePath = path.join(__dirname, 'employees.xlsx');

    // Check if the file exists
    if (!fs.existsSync(excelFilePath)) {
      console.error(`Excel file not found: ${excelFilePath}`);
      console.log('Please place your Excel file named "employees.xlsx" in the project root directory.');
      client.release();
      await pool.end();
      return;
    }

    // Read the Excel file
    console.log('Reading Excel file...');
    const workbook = xlsx.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} rows of data to import`);

    // Get company IDs
    const companyRes = await client.query('SELECT id, name FROM companies');
    const companies = companyRes.rows;

    // Create a map of company name to ID
    const companyMap = {};
    companies.forEach(company => {
      companyMap[company.name.toLowerCase()] = company.id;
    });

    // Default company ID (use the first company if no match is found)
    const defaultCompanyId = companies[0]?.id;

    if (!defaultCompanyId) {
      throw new Error('No companies found in the database. Please run setup-database.js first.');
    }

    // Start a transaction
    await client.query('BEGIN');

    // Import each row
    let successCount = 0;
    let errorCount = 0;

    for (const [index, row] of data.entries()) {
      try {
        // Extract and sanitize data from the Excel row based on your exact column structure
        // EMPLOYEE ID	NAME	TRADE	NATIONALITY	JOINING DATE	DATE OF BIRTH	MOBILE NUMBER	HOME PHONE NUMBER	EMAIL ID	COMPANY ID	COMPANY NAME
        const employeeData = {
          employee_id: sanitizeText(row['EMPLOYEE ID'] || `EMP${1000 + index}`),
          name: sanitizeText(row['NAME'] || ''),
          trade: sanitizeText(row['TRADE'] || ''),
          nationality: sanitizeText(row['NATIONALITY'] || ''),
          join_date: formatDate(row['JOINING DATE'] || new Date()),
          date_of_birth: formatDate(row['DATE OF BIRTH'] || null),
          mobile_number: sanitizeText(row['MOBILE NUMBER'] || ''),
          home_phone_number: sanitizeText(row['HOME PHONE NUMBER'] || null),
          email: sanitizeText(row['EMAIL ID'] || `${row['NAME']?.replace(/\s+/g, '.').toLowerCase() || 'employee'}@cubstechnical.com`),
          company_id: null, // We'll handle this separately based on COMPANY ID and COMPANY NAME
          visa_expiry_date: formatDate(row['VISA EXPIRY DATE'] || null),
          department: sanitizeText(row['DEPARTMENT'] || null),
          position: sanitizeText(row['POSITION'] || null),
          address: sanitizeText(row['ADDRESS'] || null),
          passport_number: sanitizeText(row['PASSPORT NUMBER'] || null)
        };

        // Handle company assignment based on COMPANY ID and COMPANY NAME
        if (row['COMPANY ID'] && !isNaN(parseInt(row['COMPANY ID']))) {
          // If we have a numeric COMPANY ID, try to find the corresponding company
          const companyIndex = parseInt(row['COMPANY ID']) - 1; // Assuming 1-based indexing
          if (companyIndex >= 0 && companyIndex < companies.length) {
            employeeData.company_id = companies[companyIndex].id;
          } else {
            employeeData.company_id = defaultCompanyId;
          }
        } else if (row['COMPANY NAME']) {
          // Try to match by company name
          const companyName = row['COMPANY NAME'].toLowerCase();
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
          RETURNING id, name`,
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

        console.log(`Imported: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
        successCount++;

        // If there's emergency contact information, add it
        if (row['Emergency Contact Name'] || row['Emergency Contact Phone']) {
          const emergencyContactData = {
            employee_id: result.rows[0].id,
            name: sanitizeText(row['Emergency Contact Name'] || 'Not Provided'),
            relationship: sanitizeText(row['Emergency Contact Relationship'] || 'Not Specified'),
            phone: sanitizeText(row['Emergency Contact Phone'] || 'Not Provided')
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
      } catch (error) {
        console.error(`Error importing row ${index + 1}:`, error.message);
        errorCount++;
      }
    }

    // Commit the transaction
    await client.query('COMMIT');

    console.log(`Import completed: ${successCount} successful, ${errorCount} failed`);

    // Release the client back to the pool
    client.release();
  } catch (error) {
    console.error('Error importing data:', error);
    try {
      // Rollback in case of error
      const client = await pool.connect();
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
  } finally {
    // Close the pool
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the import
importExcelData();
