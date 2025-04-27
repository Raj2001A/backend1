-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create pgcrypto extension for better password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employees table with optimized structure
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE
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

-- Documents table with optimized structure for large files
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(255),
  storage_provider VARCHAR(50) DEFAULT 'backblaze',
  is_encrypted BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- Document metadata table (separate from documents to improve performance)
CREATE TABLE IF NOT EXISTS document_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document access logs (for audit trail)
CREATE TABLE IF NOT EXISTS document_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
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
CREATE TABLE IF NOT EXISTS scheduled_notifications (
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
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard cache table for storing pre-computed dashboard data
CREATE TABLE IF NOT EXISTS dashboard_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key VARCHAR(255) NOT NULL UNIQUE,
  cache_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
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
('system_timezone', 'Asia/Dubai', 'System timezone'),
('max_concurrent_users', '500', 'Maximum number of concurrent users'),
('document_storage_quota', '10737418240', 'Document storage quota in bytes (10GB)'),
('enable_real_time_updates', 'true', 'Enable real-time updates for dashboard');

-- Create optimized indexes for performance
-- Employee indexes
CREATE INDEX idx_employees_company_id ON employees(company_id);
CREATE INDEX idx_employees_trade ON employees(trade);
CREATE INDEX idx_employees_nationality ON employees(nationality);
CREATE INDEX idx_employees_visa_expiry_date ON employees(visa_expiry_date);
CREATE INDEX idx_employees_join_date ON employees(join_date);
CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_is_active ON employees(is_active);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);

-- Document indexes
CREATE INDEX idx_documents_employee_id ON documents(employee_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_expiry_date ON documents(expiry_date);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_file_size ON documents(file_size);
CREATE INDEX idx_documents_storage_provider ON documents(storage_provider);

-- Document metadata index
CREATE INDEX idx_document_metadata_document_id ON document_metadata(document_id);
CREATE INDEX idx_document_metadata_key ON document_metadata(key);
CREATE INDEX idx_document_metadata_key_value ON document_metadata(key, value);

-- Document access logs indexes
CREATE INDEX idx_document_access_logs_document_id ON document_access_logs(document_id);
CREATE INDEX idx_document_access_logs_user_id ON document_access_logs(user_id);
CREATE INDEX idx_document_access_logs_accessed_at ON document_access_logs(accessed_at);

-- Emergency contacts index
CREATE INDEX idx_emergency_contacts_employee_id ON emergency_contacts(employee_id);

-- Notification indexes
CREATE INDEX idx_scheduled_notifications_employee_id ON scheduled_notifications(employee_id);
CREATE INDEX idx_scheduled_notifications_document_id ON scheduled_notifications(document_id);
CREATE INDEX idx_scheduled_notifications_scheduled_date ON scheduled_notifications(scheduled_date);
CREATE INDEX idx_scheduled_notifications_sent ON scheduled_notifications(sent);

-- User sessions indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_last_active_at ON user_sessions(last_active_at);

-- Dashboard cache index
CREATE INDEX idx_dashboard_cache_expires_at ON dashboard_cache(expires_at);

-- Create partial indexes for common queries
CREATE INDEX idx_employees_active_visa_expiry ON employees(visa_expiry_date) 
WHERE is_active = TRUE AND visa_expiry_date IS NOT NULL;

CREATE INDEX idx_documents_active_expiry ON documents(expiry_date) 
WHERE status = 'active' AND expiry_date IS NOT NULL;

CREATE INDEX idx_scheduled_notifications_pending ON scheduled_notifications(scheduled_date) 
WHERE sent = FALSE;

-- Create composite indexes for common joins
CREATE INDEX idx_documents_employee_type ON documents(employee_id, type);
CREATE INDEX idx_employees_company_trade ON employees(company_id, trade);
CREATE INDEX idx_employees_company_nationality ON employees(company_id, nationality);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at
BEFORE UPDATE ON emergency_contacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at
BEFORE UPDATE ON notification_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create materialized view for dashboard statistics
CREATE MATERIALIZED VIEW dashboard_employee_stats AS
SELECT
  COUNT(*) AS total_employees,
  COUNT(CASE WHEN visa_expiry_date IS NOT NULL AND visa_expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) AS expiring_visas_30_days,
  COUNT(CASE WHEN visa_expiry_date IS NOT NULL AND visa_expiry_date <= CURRENT_DATE + INTERVAL '14 days' THEN 1 END) AS expiring_visas_14_days,
  COUNT(CASE WHEN visa_expiry_date IS NOT NULL AND visa_expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) AS expiring_visas_7_days,
  COUNT(DISTINCT nationality) AS nationality_count,
  COUNT(DISTINCT trade) AS trade_count,
  COUNT(CASE WHEN join_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) AS new_employees_30_days
FROM employees
WHERE is_active = TRUE;

-- Create materialized view for nationality distribution
CREATE MATERIALIZED VIEW dashboard_nationality_distribution AS
SELECT
  nationality,
  COUNT(*) AS count
FROM employees
WHERE is_active = TRUE
GROUP BY nationality
ORDER BY count DESC;

-- Create materialized view for trade distribution
CREATE MATERIALIZED VIEW dashboard_trade_distribution AS
SELECT
  trade,
  COUNT(*) AS count
FROM employees
WHERE is_active = TRUE
GROUP BY trade
ORDER BY count DESC;

-- Create materialized view for company distribution
CREATE MATERIALIZED VIEW dashboard_company_distribution AS
SELECT
  c.name AS company_name,
  COUNT(e.id) AS employee_count
FROM companies c
LEFT JOIN employees e ON c.id = e.company_id AND e.is_active = TRUE
GROUP BY c.name
ORDER BY employee_count DESC;

-- Create function to refresh dashboard materialized views
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_employee_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_nationality_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_trade_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_company_distribution;
END;
$$ LANGUAGE 'plpgsql';

-- Create index on materialized views
CREATE UNIQUE INDEX idx_dashboard_nationality_distribution ON dashboard_nationality_distribution(nationality);
CREATE UNIQUE INDEX idx_dashboard_trade_distribution ON dashboard_trade_distribution(trade);
CREATE UNIQUE INDEX idx_dashboard_company_distribution ON dashboard_company_distribution(company_name);

-- Create function to automatically update dashboard views when data changes
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_views()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue a job to refresh the materialized views
  -- This is a placeholder - in a real implementation, you would use pg_notify or a similar mechanism
  -- to trigger an asynchronous refresh
  PERFORM pg_notify('refresh_dashboard_views', '');
  RETURN NULL;
END;
$$ LANGUAGE 'plpgsql';

-- Create triggers to refresh dashboard views when data changes
CREATE TRIGGER refresh_dashboard_on_employee_change
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH STATEMENT EXECUTE FUNCTION trigger_refresh_dashboard_views();

CREATE TRIGGER refresh_dashboard_on_document_change
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH STATEMENT EXECUTE FUNCTION trigger_refresh_dashboard_views();

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE 'plpgsql';

-- Create function to clean up expired dashboard cache
CREATE OR REPLACE FUNCTION cleanup_expired_dashboard_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM dashboard_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE 'plpgsql';
