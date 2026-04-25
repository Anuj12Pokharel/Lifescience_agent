import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const page_size = parseInt(searchParams.get('page_size') || '10');
  
  // Mock response following the API specification format
  const mockPublicAgents = [
    {
      id: "agent-1",
      name: "Research Assistant",
      subtitle: "AI Research Helper",
      description: "Advanced AI assistant for research tasks and scientific analysis",
      slug: "research-assistant",
      agent_type: "assistant",
      status: "live",
      latency: "instant",
      efficiency: 95,
      is_active: true,
      has_access: true,
      requires_auth: true,
      config: {
        model: "gpt-4",
        temperature: 0.7,
        max_tokens: 2000
      },
      created_at: "2024-01-01T00:00:00Z"
    },
    {
      id: "agent-2",
      name: "Data Analyst",
      subtitle: "Data Analysis Expert",
      description: "Specialized AI for data analysis, visualization and insights",
      slug: "data-analyst",
      agent_type: "analyzer",
      status: "live",
      latency: "fast",
      efficiency: 90,
      is_active: true,
      has_access: true,
      requires_auth: true,
      config: {
        model: "gpt-4",
        temperature: 0.3,
        max_tokens: 1500
      },
      created_at: "2024-01-02T00:00:00Z"
    },
    {
      id: "agent-3",
      name: "Project Tracker",
      subtitle: "Project Management",
      description: "AI-powered project tracking, management and workflow automation",
      slug: "project-tracker",
      agent_type: "automation",
      status: "live",
      latency: "fast",
      efficiency: 88,
      is_active: true,
      has_access: false,
      requires_auth: true,
      config: {
        model: "gpt-4",
        temperature: 0.5,
        max_tokens: 1000
      },
      created_at: "2024-01-03T00:00:00Z"
    },
    {
      id: "agent-4",
      name: "Code Assistant",
      subtitle: "Programming Helper",
      description: "AI assistant for code generation, debugging and optimization",
      slug: "code-assistant",
      agent_type: "assistant",
      status: "offline",
      latency: "moderate",
      efficiency: 85,
      is_active: false,
      has_access: false,
      requires_auth: true,
      config: {
        model: "gpt-4",
        temperature: 0.2,
        max_tokens: 2000
      },
      created_at: "2024-01-04T00:00:00Z"
    }
  ];

  // Simulate pagination
  const total = mockPublicAgents.length;
  const start = (page - 1) * page_size;
  const end = start + page_size;
  const results = mockPublicAgents.slice(start, end);

  return NextResponse.json({
    success: true,
    count: total,
    next: end < total ? `http://localhost:3000/api/v1/agents/public/?page=${page + 1}&page_size=${page_size}` : null,
    previous: page > 1 ? `http://localhost:3000/api/v1/agents/public/?page=${page - 1}&page_size=${page_size}` : null,
    results
  });
}
