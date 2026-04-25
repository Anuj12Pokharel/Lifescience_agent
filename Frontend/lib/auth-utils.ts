import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  is_verified: boolean;
  profile?: Record<string, unknown>;
}

export async function authenticateRequest(request: NextRequest): Promise<{ user: User | null; error?: string }> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'No authorization header' };
    }

    const token = authHeader.substring(7);
    
    // Try to verify JWT token first (for real API)
    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Extract user info from token
      const user: User = {
        id: decoded.user_id,
        email: decoded.email || 'unknown@example.com',
        role: decoded.role || 'user',
        is_verified: true
      };
      
      return { user };
    } catch (jwtError) {
      // If JWT verification fails, try mock tokens
      console.log('[Auth] JWT verification failed, trying mock tokens');
      
      if (token === 'mock-admin-token') {
        return { 
          user: {
            id: 'admin-uuid-1',
            email: 'admin@lifescienceai.com.au',
            role: 'admin',
            is_verified: true
          }
        };
      }
      
      if (token === 'mock-superadmin-token') {
        return { 
          user: {
            id: 'superadmin-uuid-1',
            email: 'superadmin@lifescienceai.com.au',
            role: 'superadmin',
            is_verified: true
          }
        };
      }
      
      if (token === 'mock-user-token') {
        return { 
          user: {
            id: 'user-uuid-1',
            email: 'user@lifescienceai.com.au',
            role: 'user',
            is_verified: true
          }
        };
      }
      
      return { user: null, error: 'Invalid token' };
    }
  } catch (error: any) {
    console.error('[Auth]', error);
    return { user: null, error: 'Authentication failed' };
  }
}

export function checkPermissions(user: User | null, requiredRole: 'admin' | 'superadmin'): boolean {
  if (!user) return false;
  
  if (requiredRole === 'superadmin') {
    return user.role === 'superadmin';
  }
  
  if (requiredRole === 'admin') {
    return user.role === 'admin' || user.role === 'superadmin';
  }
  
  return false;
}

export function canEditResource(user: User | null, resourceManagedBy: string | null): boolean {
  if (!user) return false;
  
  // Superadmin can edit everything
  if (user.role === 'superadmin') return true;
  
  // Admin can edit if resource is unassigned or assigned to them
  if (user.role === 'admin') {
    return !resourceManagedBy || resourceManagedBy === user.id;
  }
  
  // Regular users cannot edit
  return false;
}
