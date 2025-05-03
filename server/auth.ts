import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { authenticateToken, authorizeRoles } from './middleware/auth';
import { z } from 'zod';

// Use the correct types directly inline
type User = {
  id: number;
  username: string;
  password: string;
  role: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  active: boolean;
  createdAt: Date;
  lastLogin?: Date;
};

// Define the insert type for user creation
type InsertUser = {
  username: string;
  password: string;
  role?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
};

// Secret for JWT - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'warehouse-management-temp-secret';
const TOKEN_EXPIRY = '24h'; // Token expires after 24 hours

// Use promisify to convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

// Password hashing function
export async function hashPassword(password: string): Promise<string> {
  // Generate a salt
  const salt = randomBytes(16).toString('hex');
  // Hash the password with the salt
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  // Return the hashed password with the salt appended
  return `${derivedKey.toString('hex')}.${salt}`;
}

// Password verification function
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // Split the stored hash into the hash and the salt
  const [storedHash, salt] = hashedPassword.split('.');
  // Hash the provided password with the same salt
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  // Compare the hashes using timing-safe comparison
  return timingSafeEqual(
    Buffer.from(storedHash, 'hex'),
    derivedKey
  );
}

// Generate a JWT token for a user
export function generateToken(user: User): string {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Authentication handler for login
export async function authenticate(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find the user by username
    const user = await storage.getUserByUsername(username);
    
    // If user not found or inactive
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Verify the password
    const isPasswordValid = await verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Generate a token
    const token = generateToken(user);
    
    // Update last login timestamp
    await storage.updateUser(user.id, { lastLogin: new Date() });
    
    // Return user info and token (without the password)
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(200).json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

// Registration handler
export async function register(req: Request, res: Response) {
  try {
    const { username, password, ...userData } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Create the user
    const newUser = await storage.createUser({
      username,
      password: hashedPassword,
      role: 'viewer', // Default role for new users
      ...userData
    });
    
    // Generate a token
    const token = generateToken(newUser);
    
    // Return user info and token (without the password)
    const { password: _, ...userWithoutPassword } = newUser;
    
    return res.status(201).json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}

// Password change handler
export async function changePassword(req: Request, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = (req as any).user;
    
    // Input validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    // Check if the user is authenticated
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get the user with password from storage to verify the current password
    const fullUser = await storage.getUserByUsername(user.username);
    
    if (!fullUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify the current password
    const isPasswordValid = await verifyPassword(currentPassword, fullUser.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user's password
    await storage.updateUser(user.userId, { password: hashedPassword });
    
    // Generate a new token with updated information
    const updatedUser = await storage.getUserById(user.userId);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found after password update' });
    }
    
    const token = generateToken(updatedUser);
    
    return res.status(200).json({
      message: 'Password changed successfully',
      token
    });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Internal server error during password change' });
  }
}

// Admin password reset handler
export async function adminResetPassword(req: Request, res: Response) {
  try {
    const { userId, newPassword } = req.body;
    const adminUser = (req as any).user;
    
    // Input validation
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'User ID and new password are required' });
    }
    
    // Check if the admin is authenticated and has admin privileges
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }
    
    // Get the target user
    const targetUser = await storage.getUserById(userId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user's password
    await storage.updateUser(userId, { password: hashedPassword });
    
    return res.status(200).json({
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Admin password reset error:', error);
    return res.status(500).json({ error: 'Internal server error during password reset' });
  }
}

// Setup auth routes and middleware
export function setupAuth(app: any) {
  // Login route
  app.post('/api/auth/login', authenticate);
  
  // Registration route
  app.post('/api/auth/register', register);
  
  // Password change route (requires authentication)
  app.post('/api/auth/change-password', authenticateToken, changePassword);
  
  // Admin password reset route (requires admin privileges)
  app.post('/api/auth/admin-reset-password', authenticateToken, authorizeRoles('admin'), adminResetPassword);
  
  // Get current user route
  app.get('/api/auth/me', (req: Request, res: Response) => {
    // The user will be set by the authenticateToken middleware if the token is valid
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    return res.status(200).json({ user });
  });
}