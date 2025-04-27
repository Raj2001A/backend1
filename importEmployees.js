require('dotenv').config();
const fs = require('fs');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
});

async function importEmployees() {
  const parser = fs.createReadStream('employees.csv').pipe(parse({ columns: true, trim: true }));
  let count = 0;
  for await (const row of parser) {
    try {
      await pool.query(
        `INSERT INTO employees 
          (employee_id, name, trade, nationality, date_of_birth, mobile_number, home_phone_number, email_id, company_id, company_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (employee_id) DO NOTHING`,
        [
          row['EMPLOYEE ID'],
          row['NAME'],
          row['TRADE'],
          row['NATIONALITY'],
          row['DATE OF BIRTH'],
          row['MOBILE NUMBER'],
          row['HOME PHONE NUMBER'],
          row['EMAIL ID'],
          row['COMPANY ID'],
          row['COMPANY NAME']
        ]
      );
      count++;
    } catch (err) {
      console.error('Error inserting row:', row, err.message);
    }
  }
  await pool.end();
  console.log(`Import complete! Rows processed: ${count}`);
}

importEmployees().catch(console.error);
