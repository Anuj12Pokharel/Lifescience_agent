import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Mock response following the API specification format
  const mockUserAgents = {
    user: {
      id: params.userId,
      email: "user@example.com"
    },
    agents: [
      {
        agent_id: "agent-1",
        name: "Research Assistant",
        description: "AI-powered research assistant for scientific analysis",
        slug: "research-assistant",
        agent_type: "assistant",
        agent_is_active: true,
        has_access: true,
        access_is_active: true,
        access_is_expired: false,
        expires_at: null,
        granted_by: "admin@example.com"
      },
      {
        agent_id: "agent-2",
        name: "Data Analyst",
        description: "Advanced data analysis and visualization tool",
        slug: "data-analyst",
        agent_type: "analyzer",
        agent_is_active: true,
        has_access: false,
        access_is_active: false,
        access_is_expired: false,
        expires_at: null,
        granted_by: null
      },
      {
        agent_id: "agent-3",
        name: "Project Tracker",
        description: "AI-powered project management and tracking",
        slug: "project-tracker",
        agent_type: "automation",
        agent_is_active: true,
        has_access: true,
        access_is_active: true,
        access_is_expired: false,
        expires_at: "2024-12-31T23:59:59Z",
        granted_by: "manager@example.com"
      }
    ]
  };

  return NextResponse.json({
    success: true,
    data: mockUserAgents
  });
}
