import express from 'express';
import { EmployeeModel } from '../models/employee';
import { ApiError, NotFoundError } from '../middleware/error';
import { validate, validationSchemas } from '../middleware/validation';
import { searchLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = express.Router();

// Get all employees with pagination
router.get('/',
  validate(validationSchemas.pagination),
  async (req, res, next) => {
    try {
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 1000;

      // Get paginated employees
      const { employees, total } = await EmployeeModel.getAll(page, limit);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      // Improved logging for debugging
      logger.info('Fetched employees', {
        count: employees.length,
        total,
        page,
        limit
      });

      // Return only the shape expected by the frontend
      res.json({
        data: employees,
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage
      });
    } catch (error) {
      logger.error('Error getting all employees', {
        error: error instanceof Error ? error.message : String(error),
        page: req.query.page,
        limit: req.query.limit
      });
      next(error);
    }
  }
);

// Get employee by ID
router.get('/:id',
  validate(validationSchemas.id),
  async (req, res, next) => {
    try {
      const employee = await EmployeeModel.getById(req.params.id);

      if (!employee) {
        throw new NotFoundError(`Employee with ID ${req.params.id} not found`);
      }

      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      logger.error('Error getting employee by ID', {
        id: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  }
);

// Create new employee
router.post('/',
  validate(validationSchemas.employee),
  async (req, res, next) => {
    try {
      const employee = await EmployeeModel.create(req.body);

      logger.info('New employee created', {
        id: employee.id,
        name: employee.name,
        employeeId: employee.employee_id
      });

      res.status(201).json({
        success: true,
        data: employee
      });
    } catch (error) {
      logger.error('Error creating employee', {
        body: req.body,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  }
);

// Update employee
router.put('/:id',
  validate({ ...validationSchemas.id, ...validationSchemas.employee }),
  async (req, res, next) => {
    try {
      const employee = await EmployeeModel.update(req.params.id, req.body);

      if (!employee) {
        throw new NotFoundError(`Employee with ID ${req.params.id} not found`);
      }

      logger.info('Employee updated', {
        id: req.params.id,
        name: employee.name,
        employeeId: employee.employee_id
      });

      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      logger.error('Error updating employee', {
        id: req.params.id,
        body: req.body,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  }
);

// Delete employee
router.delete('/:id',
  validate(validationSchemas.id),
  async (req, res, next) => {
    try {
      const deleted = await EmployeeModel.delete(req.params.id);

      if (!deleted) {
        throw new NotFoundError(`Employee with ID ${req.params.id} not found`);
      }

      logger.info('Employee deleted', { id: req.params.id });

      res.json({
        success: true,
        message: 'Employee deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting employee', {
        id: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  }
);

// Get employees with expiring visas
router.get('/visa-expiry/reminders', async (req, res, next) => {
  try {
    // Get limit parameter or default to 10
    const limit = parseInt(req.query.limit as string) || 10;

    // Get employees with expiring visas
    const expiringVisas = await EmployeeModel.getWithExpiringVisas(30);

    res.json({
      success: true,
      count: expiringVisas.length,
      data: expiringVisas
    });
  } catch (error) {
    logger.error('Error getting visa expiry reminders', {
      error: error instanceof Error ? error.message : String(error),
      limit: req.query.limit
    });
    next(error);
  }
});

// Search employees with pagination
router.get('/search/:query',
  searchLimiter, // Apply search-specific rate limiter
  validate(validationSchemas.search),
  async (req, res, next) => {
    try {
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 1000;

      // Get paginated search results
      const { employees, total } = await EmployeeModel.search(req.params.query, page, limit);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        success: true,
        count: employees.length,
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        data: employees
      });
    } catch (error) {
      logger.error('Error searching employees', {
        query: req.params.query,
        page: req.query.page,
        limit: req.query.limit,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  }
);

// Get employees by company with pagination
router.get('/company/:companyId',
  validate({
    params: [
      { field: 'companyId', type: 'string', required: true }
    ],
    ...validationSchemas.pagination
  }),
  async (req, res, next) => {
    try {
      const { companyId } = req.params;

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 1000;

      // Get paginated employees for this company
      const { employees, total } = await EmployeeModel.getByCompany(companyId, page, limit);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        success: true,
        count: employees.length,
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        data: employees
      });
    } catch (error) {
      logger.error('Error getting employees by company', {
        companyId: req.params.companyId,
        page: req.query.page,
        limit: req.query.limit,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  }
);

export default router;
