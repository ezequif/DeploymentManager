import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';

// Secret for JWT - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'warehouse-management-temp-secret';

// Interface for user in token payload
interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

// Middleware to authenticate API requests
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Get the auth header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
  
  // If no token, return unauthorized
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    // Verify the token
    const decoded = verify(token, JWT_SECRET) as TokenPayload;
    
    // Add user info to request for use in route handlers
    (req as any).user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
    
    // Log successful authentication for audit purposes
    console.log(`Authenticated API request from user: ${decoded.username}, role: ${decoded.role}`);
    
    next();
  } catch (error) {
    // If token is invalid or expired
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Role-based authorization middleware
export function authorizeRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    // If no user (shouldn't happen if auth middleware is used first), return unauthorized
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user's role is in the allowed roles
    if (allowedRoles.includes(user.role)) {
      next();
    } else {
      return res.status(403).json({ 
        error: 'Insufficient permissions for this operation' 
      });
    }
  };
}

// For public endpoints that benefit from knowing the user but don't require auth
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    // Continue without authentication
    next();
    return;
  }
  
  try {
    const decoded = verify(token, JWT_SECRET) as TokenPayload;
    (req as any).user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
  } catch (error) {
    // Ignore token errors for optional authentication
  }
  
  next();
}