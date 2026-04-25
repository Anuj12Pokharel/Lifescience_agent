import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Mock response matching the real API structure with pagination
  const mockMyAgents = [
    {
      agent_id: "6d01f79a-141f-49f9-9020-5a7697affd1a",
      name: "Data Analyst",
      subtitle: "Data Scientist",
      description: "Advanced analysis and visualization for complex biological datasets.",
      slug: "data-analyst",
      agent_type: "custom",
      status: "live",
      latency: "instant",
      efficiency: 96,
      is_active: true,
      is_expired: false,
      granted_by: "superadmin@gmail.com",
      granted_at: "2026-03-29T16:08:38.843292Z",
      expires_at: null,
      assigned_to_users: 0,
      assigned_to_groups: 1
    },
    {
      agent_id: "agent-2",
      name: "Research Assistant",
      subtitle: "AI Research Helper",
      description: "Advanced AI assistant for research tasks and scientific analysis",
      slug: "research-assistant",
      agent_type: "assistant",
      status: "live",
      latency: "instant",
      efficiency: 95,
      is_active: true,
      is_expired: false,
      granted_by: "superadmin@gmail.com",
      granted_at: "2026-03-29T16:08:38.843292Z",
      expires_at: null,
      assigned_to_users: 3,
      assigned_to_groups: 1
    },
    {
      agent_id: "agent-3",
      name: "Project Tracker",
      subtitle: "Project Management",
      description: "AI-powered project tracking, management and workflow automation",
      slug: "project-tracker",
      agent_type: "automation",
      status: "live",
      latency: "fast",
      efficiency: 88,
      is_active: true,
      is_expired: false,
      granted_by: "superadmin@gmail.com",
      granted_at: "2026-03-29T16:08:38.843292Z",
      expires_at: null,
      assigned_to_users: 2,
      assigned_to_groups: 1
    }
  ];

  return NextResponse.json({
    success: true,
    pagination: {
      count: mockMyAgents.length,
      total_pages: 1,
      current_page: 1,
      page_size: 20,
      next: null,
      previous: null
    },
    results: mockMyAgents
  });
}
