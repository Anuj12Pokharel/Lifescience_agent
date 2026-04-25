import { NextRequest, NextResponse } from 'next/server';

// Public endpoints that don't require authentication
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register', 
  '/auth/forgot-password',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/reset-password',
  '/auth/token/refresh',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/logout',
  '/tts',
  '/chat',
  '/project-chat',
  '/api/tts',
  '/api/chat',
  '/api/project-chat'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for public paths
  if (PUBLIC_PATHS.some(path => pathname.includes(path))) {
    return NextResponse.next();
  }

  // Skip for static files
  if (pathname.includes('.') || pathname.includes('_next') || pathname.includes('favicon')) {
    return NextResponse.next();
  }

  try {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      // Redirect to login for protected routes
      if (pathname.startsWith('/admin') || pathname.startsWith('/api/v1')) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.next();
    }

    // For API routes, we'll let the individual handlers validate the token
    // and extract user info. This middleware just ensures token exists.
    
    return NextResponse.next();
  } catch (error) {
    console.error('[Middleware]', error);
    
    // Redirect to login on error
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/v1')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
