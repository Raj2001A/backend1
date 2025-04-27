/**
 * Setup Database Schema
 * This script creates the necessary tables in the database if they don't exist
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Get connection string from environment
const connectionString = process.env.NEON_DATABASE_URL;

console.log('Setting up database schema...');
console.log(`Connection string: ${connectionString?.replace(/:[^:]*@/, ':****@')}`);

// Create a new pool with non-strict SSL for development
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Disable SSL validation for development
  }
});

// SQL to create tables
const createTablesSql = `
-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  trade VARCHAR(100),
  nationality VARCHAR(100),
  join_date DATE,
  date_of_birth DATE,
  mobile_number VARCHAR(50),
  home_phone_number VARCHAR(50),
  email VARCHAR(255),
  company_id INTEGER REFERENCES companies(id),
  visa_expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  upload_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  phone VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_employee_id ON emergency_contacts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_visa_expiry ON employees(visa_expiry_date);
`;

// Function to set up the database schema
async function setupDatabaseSchema() {
  let client;
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('Successfully connected to database!');

    // Check if tables exist
    console.log('Checking for existing tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('No tables found. Creating schema...');
      await client.query(createTablesSql);
      console.log('Schema created successfully!');
    } else {
      console.log('Existing tables found:');
      tablesResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
      
      // Create any missing tables
      console.log('Ensuring all required tables exist...');
      await client.query(createTablesSql);
      console.log('Schema update completed!');
    }

    // Insert sample companies if none exist
    const companiesCount = await client.query('SELECT COUNT(*) FROM companies');
    if (parseInt(companiesCount.rows[0].count) === 0) {
      console.log('No companies found. Inserting sample companies...');
      await client.query(`
        INSERT INTO companies (name, location, contact_email, contact_phone)
        VALUES 
          ('Cub Technical Services', 'Dubai, UAE', 'info@cubstechnical.com', '+971501234567'),
          ('Cub Technical Contracting', 'Abu Dhabi, UAE', 'contracts@cubstechnical.com', '+971502345678'),
          ('Cub Technical Maintenance', 'Sharjah, UAE', 'maintenance@cubstechnical.com', '+971503456789')
      `);
      console.log('Sample companies inserted!');
    }

    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the setup
setupDatabaseSchema();
