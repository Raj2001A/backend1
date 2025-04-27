# Employee Management System Backend

Backend API for the Employee Management System, built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- Employee management (CRUD operations)
- Document management with Backblaze B2 storage
- Company management
- Firebase authentication
- Email notifications with SendGrid
- PostgreSQL database with Neon

## Tech Stack

- **Node.js & Express**: API framework
- **TypeScript**: Type safety
- **PostgreSQL (Neon)**: Database
- **Backblaze B2**: Document storage
- **Firebase**: Authentication and push notifications
- **SendGrid**: Email notifications

## Prerequisites

- Node.js (v14+)
- npm or yarn
- PostgreSQL database (Neon)
- Backblaze B2 account
- Firebase project
- SendGrid account

## Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd employee-management-backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=5000
NODE_ENV=development

# Neon PostgreSQL
NEON_DATABASE_URL=your_neon_postgres_connection_string

# Backblaze B2
B2_APP_KEY_ID=your_backblaze_key_id
B2_APP_KEY=your_backblaze_app_key
B2_BUCKET_ID=your_backblaze_bucket_id
B2_BUCKET_NAME=your_backblaze_bucket_name

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
NOTIFICATION_FROM_EMAIL=notifications@yourcompany.com

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# JWT Secret (for additional token validation if needed)
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1d
```

4. **Set up the database**

Create a PostgreSQL database and run the schema.sql script:

```bash
psql -U your_username -d your_database_name -a -f database/schema.sql
```

Or use the Neon PostgreSQL web console to run the SQL script.

5. **Build the project**

```bash
npm run build
```

6. **Start the server**

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user profile

### Employees

- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get employee by ID
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `GET /api/employees/search` - Search employees

### Documents

- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get document by ID
- `POST /api/documents` - Upload new document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/employee/:employeeId` - Get documents by employee
- `GET /api/documents/expiring` - Get expiring documents

### Companies

- `GET /api/companies` - Get all companies
- `GET /api/companies/:id` - Get company by ID
- `POST /api/companies` - Create new company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Deployment

1. Build the project:

```bash
npm run build
```

2. Set environment variables in your production environment.

3. Start the server:

```bash
npm start
```

## License

[MIT](LICENSE)
