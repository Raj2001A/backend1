import { Request, Response, NextFunction } from 'express';
import firebase from '../config/firebase';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        role?: string;
      };
    }
  }
}

/**
 * Middleware to verify Firebase authentication token
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Handle mock token for development
    if (process.env.NODE_ENV === 'development' && token === 'mock-token-for-development') {
      req.user = {
        uid: 'admin-user',
        email: 'admin@example.com',
        role: 'Administrator'
      };
      return next();
    }

    try {
      // Verify the token with Firebase
      const decodedToken = await firebase.auth().verifyIdToken(token);

      // Get user record to check custom claims
      const userRecord = await firebase.auth().getUser(decodedToken.uid);
      const customClaims = userRecord.customClaims || {};

      // Add user info to request object
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        role: customClaims.role || 'employee' // Get role from custom claims
      };

      next();
    } catch (firebaseError) {
      console.error('Firebase authentication error:', firebaseError);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'Administrator') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

export const authenticateJWT = (req: any, res: any, next: any) => {
  // Placeholder JWT authentication logic
  next();
};

export const checkAdminAccess = (req: any, res: any, next: any) => {
  // Placeholder admin access logic
  next();
};
