# Employee Management API Documentation

## Overview

This document provides comprehensive documentation for the Employee Management API. The API allows you to manage employees, documents, companies, and authentication.

## Base URL

```
http://localhost:5002/api
```

## Authentication

The API uses JWT (JSON Web Token) authentication. To access protected endpoints, you need to include the JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Authentication Endpoints

#### Login

```
POST /auth/login
```

Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "uid": "admin-user",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "Administrator"
    },
    "token": "jwt-token-here"
  }
}
```

#### Register

```
POST /auth/register
```

Registers a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "uid": "user-id",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "role": "employee"
    },
    "token": "jwt-token-here"
  }
}
```

#### Get Current User

```
GET /auth/me
```

Returns the current authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "uid": "user-id",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "role": "employee"
    },
    "employeeDetails": {
      "id": "employee-id",
      "employee_id": "EMP001",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "trade": "Engineer",
      "nationality": "USA",
      "company_id": "company-id",
      "company_name": "Cub Technical Services"
    }
  }
}
```

#### Logout

```
POST /auth/logout
```

Logs out the current user by revoking the token.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Employee Endpoints

### Get All Employees

```
GET /employees
```

Returns a list of all employees.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of items per page (default: 1000)

**Response:**
```json
{
  "success": true,
  "count": 2,
  "total": 2,
  "page": 1,
  "totalPages": 1,
  "data": [
    {
      "id": "employee-id-1",
      "employee_id": "EMP001",
      "name": "John Doe",
      "trade": "Engineer",
      "nationality": "USA",
      "join_date": "2023-01-15T00:00:00.000Z",
      "date_of_birth": "1985-05-20T00:00:00.000Z",
      "mobile_number": "+1234567890",
      "home_phone_number": "+1987654321",
      "email": "john.doe@example.com",
      "company_id": "company-id",
      "company_name": "Cub Technical Services",
      "visa_expiry_date": "2024-01-15T00:00:00.000Z"
    },
    {
      "id": "employee-id-2",
      "employee_id": "EMP002",
      "name": "Jane Smith",
      "trade": "Project Manager",
      "nationality": "UK",
      "join_date": "2023-02-10T00:00:00.000Z",
      "date_of_birth": "1990-08-15T00:00:00.000Z",
      "mobile_number": "+1234567891",
      "home_phone_number": "+1987654322",
      "email": "jane.smith@example.com",
      "company_id": "company-id",
      "company_name": "Cub Technical Services",
      "visa_expiry_date": "2024-02-10T00:00:00.000Z"
    }
  ]
}
```

### Get Employee by ID

```
GET /employees/:id
```

Returns a specific employee by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "employee-id",
    "employee_id": "EMP001",
    "name": "John Doe",
    "trade": "Engineer",
    "nationality": "USA",
    "join_date": "2023-01-15T00:00:00.000Z",
    "date_of_birth": "1985-05-20T00:00:00.000Z",
    "mobile_number": "+1234567890",
    "home_phone_number": "+1987654321",
    "email": "john.doe@example.com",
    "company_id": "company-id",
    "company_name": "Cub Technical Services",
    "visa_expiry_date": "2024-01-15T00:00:00.000Z"
  }
}
```

### Create Employee

```
POST /employees
```

Creates a new employee.

**Request Body:**
```json
{
  "employee_id": "EMP003",
  "name": "Bob Johnson",
  "trade": "Electrician",
  "nationality": "Canada",
  "join_date": "2023-03-01",
  "date_of_birth": "1988-11-12",
  "mobile_number": "+1234567892",
  "home_phone_number": "+1987654323",
  "email": "bob.johnson@example.com",
  "company_id": "company-id",
  "visa_expiry_date": "2024-03-01"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "employee-id",
    "employee_id": "EMP003",
    "name": "Bob Johnson",
    "trade": "Electrician",
    "nationality": "Canada",
    "join_date": "2023-03-01T00:00:00.000Z",
    "date_of_birth": "1988-11-12T00:00:00.000Z",
    "mobile_number": "+1234567892",
    "home_phone_number": "+1987654323",
    "email": "bob.johnson@example.com",
    "company_id": "company-id",
    "company_name": "Cub Technical Services",
    "visa_expiry_date": "2024-03-01T00:00:00.000Z"
  }
}
```

### Update Employee

```
PUT /employees/:id
```

Updates an existing employee.

**Request Body:**
```json
{
  "name": "Bob Johnson Jr.",
  "mobile_number": "+1234567893",
  "visa_expiry_date": "2024-06-01"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "employee-id",
    "employee_id": "EMP003",
    "name": "Bob Johnson Jr.",
    "trade": "Electrician",
    "nationality": "Canada",
    "join_date": "2023-03-01T00:00:00.000Z",
    "date_of_birth": "1988-11-12T00:00:00.000Z",
    "mobile_number": "+1234567893",
    "home_phone_number": "+1987654323",
    "email": "bob.johnson@example.com",
    "company_id": "company-id",
    "company_name": "Cub Technical Services",
    "visa_expiry_date": "2024-06-01T00:00:00.000Z"
  }
}
```

### Delete Employee

```
DELETE /employees/:id
```

Deletes an employee.

**Response:**
```json
{
  "success": true,
  "message": "Employee deleted successfully"
}
```

### Search Employees

```
GET /employees/search/:query
```

Searches for employees.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of items per page (default: 1000)

**Response:**
```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "page": 1,
  "totalPages": 1,
  "data": [
    {
      "id": "employee-id",
      "employee_id": "EMP001",
      "name": "John Doe",
      "trade": "Engineer",
      "nationality": "USA",
      "join_date": "2023-01-15T00:00:00.000Z",
      "date_of_birth": "1985-05-20T00:00:00.000Z",
      "mobile_number": "+1234567890",
      "home_phone_number": "+1987654321",
      "email": "john.doe@example.com",
      "company_id": "company-id",
      "company_name": "Cub Technical Services",
      "visa_expiry_date": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

### Get Employees by Company

```
GET /employees/company/:companyId
```

Returns employees for a specific company.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of items per page (default: 1000)

**Response:**
```json
{
  "success": true,
  "count": 2,
  "total": 2,
  "page": 1,
  "totalPages": 1,
  "data": [
    {
      "id": "employee-id-1",
      "employee_id": "EMP001",
      "name": "John Doe",
      "trade": "Engineer",
      "nationality": "USA",
      "join_date": "2023-01-15T00:00:00.000Z",
      "date_of_birth": "1985-05-20T00:00:00.000Z",
      "mobile_number": "+1234567890",
      "home_phone_number": "+1987654321",
      "email": "john.doe@example.com",
      "company_id": "company-id",
      "company_name": "Cub Technical Services",
      "visa_expiry_date": "2024-01-15T00:00:00.000Z"
    },
    {
      "id": "employee-id-2",
      "employee_id": "EMP002",
      "name": "Jane Smith",
      "trade": "Project Manager",
      "nationality": "UK",
      "join_date": "2023-02-10T00:00:00.000Z",
      "date_of_birth": "1990-08-15T00:00:00.000Z",
      "mobile_number": "+1234567891",
      "home_phone_number": "+1987654322",
      "email": "jane.smith@example.com",
      "company_id": "company-id",
      "company_name": "Cub Technical Services",
      "visa_expiry_date": "2024-02-10T00:00:00.000Z"
    }
  ]
}
```

### Get Employees with Expiring Visas

```
GET /employees/expiring-visas
```

Returns employees with expiring visas.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "employee-id-1",
      "employee_id": "EMP001",
      "name": "John Doe",
      "trade": "Engineer",
      "nationality": "USA",
      "join_date": "2023-01-15T00:00:00.000Z",
      "date_of_birth": "1985-05-20T00:00:00.000Z",
      "mobile_number": "+1234567890",
      "home_phone_number": "+1987654321",
      "email": "john.doe@example.com",
      "company_id": "company-id",
      "company_name": "Cub Technical Services",
      "visa_expiry_date": "2024-01-15T00:00:00.000Z"
    },
    {
      "id": "employee-id-2",
      "employee_id": "EMP002",
      "name": "Jane Smith",
      "trade": "Project Manager",
      "nationality": "UK",
      "join_date": "2023-02-10T00:00:00.000Z",
      "date_of_birth": "1990-08-15T00:00:00.000Z",
      "mobile_number": "+1234567891",
      "home_phone_number": "+1987654322",
      "email": "jane.smith@example.com",
      "company_id": "company-id",
      "company_name": "Cub Technical Services",
      "visa_expiry_date": "2024-02-10T00:00:00.000Z"
    }
  ]
}
```

## Document Endpoints

### Get All Documents

```
GET /documents
```

Returns a list of all documents.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "document-id-1",
      "name": "Passport",
      "type": "PASSPORT_COPY",
      "employee_id": "employee-id-1",
      "employee_name": "John Doe",
      "file_id": "file-id-1",
      "file_name": "passport.pdf",
      "file_path": "documents/employee-id-1/passport.pdf",
      "file_size": 1024000,
      "mime_type": "application/pdf",
      "expiry_date": "2028-01-15T00:00:00.000Z",
      "status": "active",
      "created_at": "2023-01-20T00:00:00.000Z"
    },
    {
      "id": "document-id-2",
      "name": "Visa",
      "type": "VISA_COPY",
      "employee_id": "employee-id-1",
      "employee_name": "John Doe",
      "file_id": "file-id-2",
      "file_name": "visa.pdf",
      "file_path": "documents/employee-id-1/visa.pdf",
      "file_size": 512000,
      "mime_type": "application/pdf",
      "expiry_date": "2024-01-15T00:00:00.000Z",
      "status": "active",
      "created_at": "2023-01-20T00:00:00.000Z"
    }
  ]
}
```

### Get Document by ID

```
GET /documents/:id
```

Returns a specific document by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "document-id-1",
    "name": "Passport",
    "type": "PASSPORT_COPY",
    "employee_id": "employee-id-1",
    "employee_name": "John Doe",
    "file_id": "file-id-1",
    "file_name": "passport.pdf",
    "file_path": "documents/employee-id-1/passport.pdf",
    "file_size": 1024000,
    "mime_type": "application/pdf",
    "expiry_date": "2028-01-15T00:00:00.000Z",
    "status": "active",
    "created_at": "2023-01-20T00:00:00.000Z"
  }
}
```

### Get Documents by Employee ID

```
GET /documents/employee/:employeeId
```

Returns documents for a specific employee.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "document-id-1",
      "name": "Passport",
      "type": "PASSPORT_COPY",
      "employee_id": "employee-id-1",
      "employee_name": "John Doe",
      "file_id": "file-id-1",
      "file_name": "passport.pdf",
      "file_path": "documents/employee-id-1/passport.pdf",
      "file_size": 1024000,
      "mime_type": "application/pdf",
      "expiry_date": "2028-01-15T00:00:00.000Z",
      "status": "active",
      "created_at": "2023-01-20T00:00:00.000Z"
    },
    {
      "id": "document-id-2",
      "name": "Visa",
      "type": "VISA_COPY",
      "employee_id": "employee-id-1",
      "employee_name": "John Doe",
      "file_id": "file-id-2",
      "file_name": "visa.pdf",
      "file_path": "documents/employee-id-1/visa.pdf",
      "file_size": 512000,
      "mime_type": "application/pdf",
      "expiry_date": "2024-01-15T00:00:00.000Z",
      "status": "active",
      "created_at": "2023-01-20T00:00:00.000Z"
    }
  ]
}
```

### Upload Document

```
POST /documents
```

Uploads a new document.

**Request Body (multipart/form-data):**
- `file`: The document file
- `name`: Document name
- `type`: Document type
- `employee_id`: Employee ID
- `expiry_date` (optional): Document expiry date
- `notes` (optional): Document notes

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "document-id-3",
    "name": "Emirates ID",
    "type": "EMIRATES_ID",
    "employee_id": "employee-id-1",
    "employee_name": "John Doe",
    "file_id": "file-id-3",
    "file_name": "emirates-id.pdf",
    "file_path": "documents/employee-id-1/emirates-id.pdf",
    "file_size": 768000,
    "mime_type": "application/pdf",
    "expiry_date": "2025-01-15T00:00:00.000Z",
    "status": "active",
    "created_at": "2023-01-25T00:00:00.000Z"
  }
}
```

### Download Document

```
GET /documents/download/:id
```

Returns a download URL for a document.

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://f002.backblazeb2.com/file/bucket-name/documents/employee-id-1/passport.pdf",
    "fileName": "passport.pdf",
    "mimeType": "application/pdf"
  }
}
```

### Delete Document

```
DELETE /documents/:id
```

Deletes a document.

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

### Get Expiring Documents

```
GET /documents/expiring/:days
```

Returns documents with expiry dates within the specified number of days.

**Response:**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "document-id-2",
      "name": "Visa",
      "type": "VISA_COPY",
      "employee_id": "employee-id-1",
      "employee_name": "John Doe",
      "file_id": "file-id-2",
      "file_name": "visa.pdf",
      "file_path": "documents/employee-id-1/visa.pdf",
      "file_size": 512000,
      "mime_type": "application/pdf",
      "expiry_date": "2024-01-15T00:00:00.000Z",
      "status": "active",
      "created_at": "2023-01-20T00:00:00.000Z"
    }
  ]
}
```

## Company Endpoints

### Get All Companies

```
GET /companies
```

Returns a list of all companies.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "company-id-1",
      "name": "Cub Technical Services",
      "location": "Dubai, UAE",
      "created_at": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": "company-id-2",
      "name": "Cub Contracting",
      "location": "Abu Dhabi, UAE",
      "created_at": "2023-01-02T00:00:00.000Z"
    }
  ]
}
```

### Get Company by ID

```
GET /companies/:id
```

Returns a specific company by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "company-id-1",
    "name": "Cub Technical Services",
    "location": "Dubai, UAE",
    "created_at": "2023-01-01T00:00:00.000Z"
  }
}
```

### Create Company

```
POST /companies
```

Creates a new company.

**Request Body:**
```json
{
  "name": "Cub Engineering",
  "location": "Sharjah, UAE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "company-id-3",
    "name": "Cub Engineering",
    "location": "Sharjah, UAE",
    "created_at": "2023-01-03T00:00:00.000Z"
  }
}
```

### Update Company

```
PUT /companies/:id
```

Updates an existing company.

**Request Body:**
```json
{
  "name": "Cub Engineering Services",
  "location": "Sharjah, UAE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "company-id-3",
    "name": "Cub Engineering Services",
    "location": "Sharjah, UAE",
    "created_at": "2023-01-03T00:00:00.000Z",
    "updated_at": "2023-01-04T00:00:00.000Z"
  }
}
```

### Delete Company

```
DELETE /companies/:id
```

Deletes a company.

**Response:**
```json
{
  "success": true,
  "message": "Company deleted successfully"
}
```

## Error Handling

All API endpoints return a consistent error format:

```json
{
  "success": false,
  "message": "Error message",
  "error": "ERROR_TYPE",
  "errors": ["Validation error 1", "Validation error 2"]
}
```

### Common Error Types

- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: User does not have permission
- `NOT_FOUND_ERROR`: Resource not found
- `DATABASE_ERROR`: Database operation failed
- `INTERNAL_ERROR`: Internal server error

### HTTP Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Permission denied
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- General API routes: 120 requests per minute
- Employee routes: 60 requests per minute
- Search routes: 30 requests per minute

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "message": "Too many requests, please try again later",
  "error": "RATE_LIMIT_ERROR"
}
```

## Pagination

Many endpoints support pagination with the following query parameters:

- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 1000, max: 100)

Paginated responses include:

```json
{
  "success": true,
  "count": 10, // Number of items in the current page
  "total": 100, // Total number of items
  "page": 1, // Current page
  "totalPages": 10, // Total number of pages
  "data": [...]
}
```
