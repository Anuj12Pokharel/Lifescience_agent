import { NextRequest, NextResponse } from 'next/server';

// Mock user database (replace with actual database)
const mockUsers = [
  {
    id: 'user-uuid-1',
    email: 'user@lifescienceai.com.au',
    password: 'password123', // In production, use hashed passwords
    role: 'user',
    is_verified: true,
    is_active: true
  },
  {
    id: 'admin-uuid-1',
    email: 'admin@lifescienceai.com.au',
    password: 'password123',
    role: 'admin',
    is_verified: true,
    is_active: true
  },
  {
    id: 'superadmin-uuid-1',
    email: 'superadmin@lifescienceai.com.au',
    password: 'password123',
    role: 'superadmin',
    is_verified: true,
    is_active: true
  }
];

// POST /api/v1/auth/login/ - Login endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: { message: 'Email and password are required' } },
        { status: 400 }
      );
    }

    // Find user by email (in production, use database query)
    const user = mockUsers.find(u => u.email === email);

    if (!user) {
      return NextResponse.json(
        { error: { message: 'Invalid credentials' } },
        { status: 401 }
      );
    }

    // Check password (in production, use bcrypt.compare)
    if (user.password !== password) {
      return NextResponse.json(
        { error: { message: 'Invalid credentials' } },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { error: { message: 'Account is inactive' } },
        { status: 401 }
      );
    }

    // Check if user is verified
    if (!user.is_verified) {
      return NextResponse.json(
        { error: { message: 'Please verify your email first' } },
        { status: 401 }
      );
    }

    // Generate access token (in production, use JWT)
    const token = `mock-${user.role}-token`;

    // Return success response
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json({
      data: {
        access: token,
        user: userWithoutPassword
      }
    });
  } catch (error: any) {
    console.error('[Login]', error);
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
