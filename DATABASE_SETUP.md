# Database Setup and Excel Import Guide

This guide will help you set up your Neon PostgreSQL database and import your Excel data.

## Prerequisites

- Node.js installed on your computer
- Your Excel file with employee data
- Neon PostgreSQL connection string

## Step 1: Install Dependencies

First, install the required dependencies:

```bash
npm install
```

This will install all the necessary packages including:
- pg (PostgreSQL client)
- xlsx (Excel file parser)
- dotenv (Environment variable loader)

## Step 2: Prepare Your Excel File

1. Make sure your Excel file is named `employees.xlsx`
2. Place it in the root directory of the project (same level as package.json)
3. Ensure your Excel file has the following columns with EXACT column names (case-sensitive):
   - EMPLOYEE ID
   - NAME
   - TRADE
   - NATIONALITY
   - JOINING DATE
   - DATE OF BIRTH
   - MOBILE NUMBER
   - HOME PHONE NUMBER
   - EMAIL ID
   - COMPANY ID
   - COMPANY NAME

   Optional columns that can be included:
   - VISA EXPIRY DATE
   - DEPARTMENT
   - POSITION
   - ADDRESS
   - PASSPORT NUMBER

## Step 3: Set Up the Database

### Option A: If you're starting fresh (recommended for first-time setup)

If you want to start with a clean database (removing any existing tables), run:

```bash
npm run reset-db
```

This script will:
1. Connect to your Neon PostgreSQL database
2. Drop all existing tables (if any)
3. Prepare the database for a fresh setup

### Option B: Set up the database

After resetting (or if this is your first time), run the setup script:

```bash
npm run setup-db
```

This script will:
1. Connect to your Neon PostgreSQL database
2. Check if tables already exist
   - If tables exist, it will show you the current state of the database
   - If tables don't exist, it will create them
3. Create all required tables (companies, employees, documents, emergency_contacts)
4. Insert default company data
5. Create necessary indexes for performance

## Step 4: Import Excel Data

Run the Excel import script:

```bash
npm run import-excel
```

This script will:
1. Read your employees.xlsx file
2. Process each row and insert the data into the employees table
3. Create emergency contact records if that data is available
4. Handle data type conversions and validations
5. Report on successful and failed imports

## Troubleshooting

### Connection Issues

If you encounter connection issues:
- Check that your Neon PostgreSQL connection string is correct in the .env file
- Ensure your IP address is allowed in Neon's access control settings
- Verify that the database exists and is accessible

### Data Import Issues

If you encounter issues during data import:
- Check the console output for specific error messages
- Verify that your Excel column names match the expected names
- Ensure required fields have values
- Check for data format issues (especially with dates)

### Missing Excel File

If you get an error about the Excel file not being found:
- Make sure the file is named `employees.xlsx`
- Place it in the root directory of the project
- Verify the file is not corrupted or password-protected

## Verifying the Import

To verify that your data was imported correctly:

1. Log in to your Neon PostgreSQL dashboard
2. Use the SQL Editor to run queries:
   ```sql
   -- Check the number of employees imported
   SELECT COUNT(*) FROM employees;

   -- View some employee records
   SELECT * FROM employees LIMIT 10;

   -- Check emergency contacts
   SELECT * FROM emergency_contacts LIMIT 10;
   ```

## Next Steps

After successfully importing your data:

1. Start the backend server:
   ```bash
   npm run dev
   ```

2. Connect your frontend application to the backend API

3. Test the employee management features with your real data
