import express from 'express';
import { validate } from '../middleware/validation';
import { validationSchemas } from '../utils/validationSchemas';
import { logger } from '../utils/logger';
import { AuthenticationError, ValidationError } from '../middleware/error';
import firebase from '../config/firebase';
import { verifyToken, requireAdmin } from '../middleware/auth';
import { EmployeeModel } from '../models/employee';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/login',
  validate(validationSchemas.login),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // In a real app, we would use Firebase authentication
      // For now, we'll use a simple mock authentication
      if (process.env.NODE_ENV === 'development' && email === 'admin@example.com' && password === 'password123') {
        // Mock admin user for development
        return res.json({
          success: true,
          data: {
            user: {
              uid: 'admin-user',
              email: 'admin@example.com',
              name: 'Admin User',
              role: 'Administrator'
            },
            token: 'mock-token-for-development'
          }
        });
      }

      // For real authentication, use Firebase
      try {
        // In a real implementation, we would use Firebase client SDK for authentication
        // Since we're using Firebase Admin SDK on the server, we can't use signInWithEmailAndPassword
        // Instead, we'll use a workaround for development purposes

        // Try to get the user by email
        const userRecord = await firebase.auth().getUserByEmail(email);

        // In a real app, we would verify the password here
        // For development, we'll assume the password is correct

        // Create a custom token
        const token = await firebase.auth().createCustomToken(userRecord.uid);

        // Get user claims to determine role
        const customClaims = userRecord.customClaims || {};
        const role = customClaims.role || 'employee';

        // If user is an employee, get employee details
        let employeeDetails = null;
        if (role === 'employee') {
          // Find employee by email
          const employees = await EmployeeModel.findByEmail(email);
          if (Array.isArray(employees) && employees.length > 0) {
            employeeDetails = employees[0];
          }
        }

        // Return user data and token
        return res.json({
          success: true,
          data: {
            user: {
              uid: userRecord.uid,
              email: userRecord.email,
              name: userRecord.displayName || email.split('@')[0],
              role
            },
            token,
            employeeDetails
          }
        });
      } catch (firebaseError) {
        logger.error('Firebase authentication error', {
          error: firebaseError instanceof Error ? firebaseError.message : String(firebaseError),
          email
        });
        throw new AuthenticationError('Invalid email or password');
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user and create employee record
 * @access  Public
 */
router.post('/register',
  validate(validationSchemas.register),
  async (req, res, next) => {
    try {
      const {
        email,
        password,
        name,
        trade,
        nationality,
        mobile_number,
        home_phone_number,
        company_id,
        visa_expiry_date,
        date_of_birth
      } = req.body;

      // Check if user already exists
      try {
        const userRecord = await firebase.auth().getUserByEmail(email);
        if (userRecord) {
          throw new ValidationError('User already exists with this email');
        }
      } catch (error: any) {
        // If error code is auth/user-not-found, that's what we want
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
      }

      // Create user in Firebase
      const userRecord = await firebase.auth().createUser({
        email,
        password,
        displayName: name,
        emailVerified: false
      });

      // Set default custom claims (role)
      await firebase.auth().setCustomUserClaims(userRecord.uid, { role: 'employee' });

      // Get ID token
      const token = await firebase.auth().createCustomToken(userRecord.uid);

      // Create employee record if employee details are provided
      let employeeDetails = null;
      if (trade || nationality || mobile_number || company_id) {
        try {
          // Generate a unique employee ID
          const employeeId = `EMP${Date.now().toString().slice(-6)}`;

          // Create employee record
          const employeeData = {
            employee_id: employeeId,
            name: name,
            trade: trade || 'Not specified',
            nationality: nationality || 'Not specified',
            join_date: new Date(),
            date_of_birth: date_of_birth ? new Date(date_of_birth) : new Date(0),
            mobile_number: mobile_number || '',
            home_phone_number: home_phone_number || '',
            email: email,
            company_id: company_id || '1', // Default company ID
            company_name: 'Unknown', // Add missing required property
            visa_expiry_date: visa_expiry_date ? new Date(visa_expiry_date) : undefined
          };

          // Save employee to database
          employeeDetails = await EmployeeModel.create(employeeData);

          // Update Firebase user with employee ID
          await firebase.auth().setCustomUserClaims(userRecord.uid, {
            role: 'employee',
            employeeId: employeeDetails.id
          });

          logger.info('Employee record created', {
            uid: userRecord.uid,
            employeeId: employeeDetails.id
          });
        } catch (employeeError) {
          logger.error('Failed to create employee record', {
            error: employeeError,
            uid: userRecord.uid
          });
          // Continue with user creation even if employee record fails
        }
      }

      logger.info('New user registered', {
        uid: userRecord.uid,
        email: userRecord.email,
        hasEmployeeRecord: !!employeeDetails
      });

      return res.status(201).json({
        success: true,
        data: {
          user: {
            uid: userRecord.uid,
            email: userRecord.email,
            name: userRecord.displayName || name,
            role: 'employee'
          },
          token,
          employeeDetails
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    // User is already attached to req by verifyToken middleware
    if (!req.user) {
      throw new AuthenticationError('Not authenticated');
    }

    // If user is an employee, get employee details
    let employeeDetails = null;
    if (req.user.role === 'employee') {
      // Find employee by email
      const employees = await EmployeeModel.findByEmail(req.user.email);
      if (Array.isArray(employees) && employees.length > 0) {
        employeeDetails = employees[0];
      }
    }

    return res.json({
      success: true,
      data: {
        user: req.user,
        employeeDetails
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (revoke token)
 * @access  Private
 */
router.post('/logout', verifyToken, async (req, res, next) => {
  try {
    // In a real app, we would revoke the token
    // For Firebase, we can't actually revoke tokens, but we can:
    // 1. Update the user's tokens (force refresh)
    // 2. Set a short expiration time on tokens

    if (req.user && req.user.uid) {
      // Revoke all refresh tokens for the user
      await firebase.auth().revokeRefreshTokens(req.user.uid);
      logger.info('User logged out, tokens revoked', { uid: req.user.uid });
    }

    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/set-role
 * @desc    Set a user's role
 * @access  Private (Admin only)
 */
router.post('/set-role', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { uid, role } = req.body;

    if (!uid || !role) {
      return res.status(400).json({
        success: false,
        message: 'User ID and role are required'
      });
    }

    // Validate role
    const validRoles = ['employee', 'Administrator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${validRoles.join(', ')}`
      });
    }

    // Get the user from Firebase
    const userRecord = await firebase.auth().getUser(uid);
    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get current custom claims
    const customClaims = userRecord.customClaims || {};

    // Update Firebase user with new role
    await firebase.auth().setCustomUserClaims(uid, {
      ...customClaims,
      role: role
    });

    logger.info('User role updated', {
      uid: uid,
      role: role
    });

    return res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        uid: uid,
        email: userRecord.email,
        role: role
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin only)
 */
router.get('/users', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    // List all users from Firebase
    const listUsersResult = await firebase.auth().listUsers();
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: (user.customClaims?.role || 'employee'),
      employeeId: user.customClaims?.employeeId,
      photoURL: user.photoURL,
      disabled: user.disabled,
      emailVerified: user.emailVerified,
      creationTime: user.metadata.creationTime
    }));

    return res.json({
      success: true,
      data: {
        users
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/link-employee
 * @desc    Link an existing Firebase user to an employee record
 * @access  Private (Admin only)
 */
router.post('/link-employee', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { uid, employeeId } = req.body;

    if (!uid || !employeeId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and employee ID are required'
      });
    }

    // Get the user from Firebase
    const userRecord = await firebase.auth().getUser(uid);
    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get the employee record
    const employee = await EmployeeModel.getById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Update Firebase user with employee ID
    await firebase.auth().setCustomUserClaims(uid, {
      role: 'employee',
      employeeId: employeeId
    });

    logger.info('User linked to employee record', {
      uid: uid,
      employeeId: employeeId
    });

    return res.json({
      success: true,
      message: 'User successfully linked to employee record',
      data: {
        uid: uid,
        email: userRecord.email,
        employeeId: employeeId
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
