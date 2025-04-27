import express from 'express';
import { CompanyModel } from '../models/company';
import { ApiError } from '../middleware/error';

const router = express.Router();

// Get all companies
router.get('/', async (req, res, next) => {
  try {
    const companies = await CompanyModel.getAll();
    res.json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    next(error);
  }
});

// Get company by ID
router.get('/:id', async (req, res, next) => {
  try {
    const company = await CompanyModel.getById(req.params.id);
    
    if (!company) {
      throw new ApiError('Company not found', 404);
    }
    
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    next(error);
  }
});

// Create new company
router.post('/', async (req, res, next) => {
  try {
    const company = await CompanyModel.create(req.body);
    
    res.status(201).json({
      success: true,
      data: company
    });
  } catch (error) {
    next(error);
  }
});

// Update company
router.put('/:id', async (req, res, next) => {
  try {
    const company = await CompanyModel.update(req.params.id, req.body);
    
    if (!company) {
      throw new ApiError('Company not found', 404);
    }
    
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    next(error);
  }
});

// Delete company
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await CompanyModel.delete(req.params.id);
    
    if (!deleted) {
      throw new ApiError('Company not found or has associated employees', 400);
    }
    
    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get companies with employee count
router.get('/stats/employee-count', async (req, res, next) => {
  try {
    const companies = await CompanyModel.getAllWithEmployeeCount();
    
    res.json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    next(error);
  }
});

export default router;
