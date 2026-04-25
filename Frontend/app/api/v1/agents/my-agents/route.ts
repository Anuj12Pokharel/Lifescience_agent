import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Mock response following the API specification format
  const mockMyAgents = [
    {
      agent_id: "agent-1",
      name: "Research Assistant",
      subtitle: "AI Research Helper",
      description: "Advanced AI assistant for research tasks and scientific analysis",
      slug: "research-assistant",
      agent_type: "assistant",
      status: "live",
      latency: "instant",
      efficiency: 95,
      agent_is_active: true,
      access_via: "direct",
      group_name: null,
      expires_at: null,
      config: {
        model: "gpt-4",
        temperature: 0.7,
        max_tokens: 2000
      }
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
      agent_is_active: true,
      access_via: "group",
      group_name: "Research Team",
      expires_at: "2024-12-31T23:59:59Z",
      config: {
        model: "gpt-4",
        temperature: 0.5,
        max_tokens: 1000
      }
    }
  ];

  return NextResponse.json({
    success: true,
    results: mockMyAgents
  });
}
