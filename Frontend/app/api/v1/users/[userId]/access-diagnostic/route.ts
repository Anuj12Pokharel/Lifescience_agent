import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Mock response following the API specification format
  const mockDiagnostic = {
    user: {
      id: params.userId,
      email: "user@example.com",
      is_active: true,
      is_locked: false,
      managed_by: {
        id: "admin-1",
        email: "admin@example.com"
      }
    },
    summary: {
      total_agents: 5,
      accessible: 3,
      blocked: 1,
      no_access_granted: 1
    },
    agents: [
      {
        agent_id: "agent-1",
        agent_name: "Research Assistant",
        agent_is_active: true,
        has_access: true,
        access_via: "direct",
        direct_access: {
          exists: true,
          is_active: true,
          expires_at: null,
          is_expired: false
        },
        group_access: [],
        block_reasons: []
      },
      {
        agent_id: "agent-2",
        agent_name: "Data Analyst",
        agent_is_active: true,
        has_access: false,
        access_via: null,
        direct_access: {
          exists: false,
          is_active: false,
          expires_at: null,
          is_expired: false
        },
        group_access: [],
        block_reasons: ["No access granted"]
      },
      {
        agent_id: "agent-3",
        agent_name: "Project Tracker",
        agent_is_active: true,
        has_access: false,
        access_via: null,
        direct_access: {
          exists: true,
          is_active: false,
          expires_at: null,
          is_expired: false
        },
        group_access: [],
        block_reasons: ["direct: access is revoked"]
      }
    ]
  };

  return NextResponse.json({
    success: true,
    data: mockDiagnostic
  });
}
