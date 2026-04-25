import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Mock response following the API specification format
  // In a real implementation, this would fetch from the actual backend at localhost:8000
  const mockGroups = [
    {
      group_id: "group-1",
      group_name: "Research Team", 
      group_description: "Team focused on scientific research and analysis",
      agents: [
        {
          agent_id: "agent-1",
          name: "Research Assistant",
          subtitle: "AI Research Helper",
          slug: "research-assistant",
          agent_type: "assistant",
          status: "live",
          latency: "instant",
          efficiency: 95,
          agent_is_active: true
        },
        {
          agent_id: "agent-2",
          name: "Data Analyst", 
          subtitle: "Data Analysis Expert",
          slug: "data-analyst",
          agent_type: "analyzer",
          status: "live",
          latency: "fast",
          efficiency: 90,
          agent_is_active: true
        }
      ]
    },
    {
      group_id: "group-2",
      group_name: "Development Team",
      group_description: "Software development and engineering team",
      agents: [
        {
          agent_id: "agent-3",
          name: "Code Assistant",
          subtitle: "Programming Helper",
          slug: "code-assistant",
          agent_type: "assistant",
          status: "live",
          latency: "fast",
          efficiency: 88,
          agent_is_active: true
        }
      ]
    }
  ];

  return NextResponse.json({
    success: true,
    data: mockGroups
  });
}
