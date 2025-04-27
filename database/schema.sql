-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  trade VARCHAR(100) NOT NULL,
  nationality VARCHAR(100) NOT NULL,
  join_date DATE NOT NULL,
  date_of_birth DATE NOT NULL,
  mobile_number VARCHAR(50) NOT NULL,
  home_phone_number VARCHAR(50),
  email VARCHAR(255) NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id),
  visa_expiry_date DATE,
  department VARCHAR(100),
  position VARCHAR(100),
  address TEXT,
  passport_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  file_id VARCHAR(255),
  file_name VARCHAR(255),
  file_path VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(100),
  expiry_date DATE,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification settings table
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  visa_expiry_days INTEGER[] DEFAULT '{30, 14, 7}',
  document_expiry_days INTEGER[] DEFAULT '{30, 14, 7}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled notifications table
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  scheduled_date DATE NOT NULL,
  days_before_expiry INTEGER,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default companies
INSERT INTO companies (name, location) VALUES
('CUBS TECH CONTRACTING', 'SHARJAH, UAE'),
('CUBS TECHNICAL SERVICES', 'ABU DHABI, UAE'),
('CUBS ELECTROMECHANICAL', 'SHARJAH, UAE'),
('CUBS FACILITIES MANAGEMENT', 'DUBAI, UAE'),
('CUBS TECHNICAL CONSULTANCY', 'DUBAI, UAE'),
('CUBS ENGINEERING', 'ABU DHABI, UAE'),
('CUBS CONSTRUCTION', 'DUBAI, UAE'),
('CUBS MAINTENANCE', 'SHARJAH, UAE'),
('CUBS TECHNICAL TRAINING', 'DUBAI, UAE');

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('company_name', 'Cubs Technical', 'Company name for email notifications'),
('notification_email', 'admin@cubstechnical.com', 'Email address for sending notifications'),
('visa_expiry_notification_days', '30,14,7', 'Days before visa expiry to send notifications'),
('document_expiry_notification_days', '30,14,7', 'Days before document expiry to send notifications'),
('system_timezone', 'Asia/Dubai', 'System timezone');

-- Create indexes for performance
CREATE INDEX idx_employees_company_id ON employees(company_id);
CREATE INDEX idx_documents_employee_id ON documents(employee_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_expiry_date ON documents(expiry_date);
CREATE INDEX idx_emergency_contacts_employee_id ON emergency_contacts(employee_id);
CREATE INDEX idx_scheduled_notifications_employee_id ON scheduled_notifications(employee_id);
CREATE INDEX idx_scheduled_notifications_document_id ON scheduled_notifications(document_id);
CREATE INDEX idx_scheduled_notifications_scheduled_date ON scheduled_notifications(scheduled_date);
