import { NextRequest, NextResponse } from 'next/server';

// In production, this would connect to a database
// For now, we'll use mock data

// POST /api/v1/auth/register/ - Register endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, password_confirm } = body;

    if (!email || !password || !password_confirm) {
      return NextResponse.json(
        { error: { message: 'All fields are required' } },
        { status: 400 }
      );
    }

    if (password !== password_confirm) {
      return NextResponse.json(
        { error: { message: 'Passwords do not match' } },
        { status: 400 }
      );
    }

    // Basic password validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: { message: 'Password must be at least 8 characters' } },
        { status: 400 }
      );
    }

    // Check if user already exists (in production, check database)
    // For now, we'll just allow registration

    // Create new user (in production, save to database)
    const newUser = {
      id: `user-${Date.now()}`,
      email,
      role: 'user',
      is_verified: false, // Require email verification
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Generate access token
    const token = `mock-user-token`;

    // Return success response
    return NextResponse.json({
      data: {
        access: token,
        user: newUser
      },
      message: 'Registration successful. Please check your email for verification.'
    });
  } catch (error: any) {
    console.error('[Register]', error);
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
