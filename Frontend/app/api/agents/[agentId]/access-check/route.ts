import { NextRequest, NextResponse } from 'next/server';
import { agentsApi } from '@/lib/api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Get the access token from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Make internal API call to check access
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.lifescienceaiagents.com/api'}/api/v1/agents/${agentId}/access-check`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If agent doesn't exist or user doesn't have access, return false
        return NextResponse.json({ has_access: false }, { status: 200 });
      }

      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
    } catch (fetchError) {
      console.error('Error checking agent access:', fetchError);
      return NextResponse.json(
        { has_access: false },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Access check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
