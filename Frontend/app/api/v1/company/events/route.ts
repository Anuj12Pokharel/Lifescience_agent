import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, canEditResource } from '@/lib/auth-utils';

// Mock events data (replace with actual API calls)
const mockEventsData = [
  {
    id: "event-uuid-1",
    title: "AI Workshop: How to Grow Your Business With Digital Marketing Tools",
    description: "Featuring AVA AI Agent demonstrations — website creation, social media automation, avatar bot creation",
    date: "2026-02-06",
    time: "13:30:00",
    timezone: "Perth (AWST)",
    format: "Interactive workshop",
    is_active: true,
    managed_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
  },
  {
    id: "event-uuid-2",
    title: "Healthcare AI Summit 2026",
    description: "Annual summit on AI applications in healthcare, featuring keynote speakers and hands-on workshops",
    date: "2026-03-15",
    time: "09:00:00",
    timezone: "Perth (AWST)",
    format: "Conference",
    is_active: true,
    managed_by: "admin-uuid-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
  }
];

// Event data interface
interface EventData {
  title?: string;
  description?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM:SS
  timezone?: string;
  format?: string;
  is_active?: boolean;
  managed_by?: string | null; // Only superadmin can change
}

// GET /api/v1/company/events/ - Get all events with edit permissions
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    
    if (error || !user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    // Add can_edit field to each event based on user role and managed_by
    const eventsWithPermissions = mockEventsData.map(event => {
      const canEdit = user.role === 'superadmin' || 
                     (user.role === 'admin' && (!event.managed_by || event.managed_by === user.id));

      return {
        ...event,
        can_edit: canEdit,
        managed_by_email: event.managed_by ? user.email : null
      };
    });

    return NextResponse.json(eventsWithPermissions);
  } catch (error: any) {
    console.error('[Events GET]', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST /api/v1/company/events/ - Create new event with role-based permissions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, error } = await authenticateRequest(request);
    
    if (error || !user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - only admin and superadmin can create events
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Prepare event data
    const eventData: EventData = {
      ...body,
      // Auto-assign to current admin if not superadmin and no managed_by specified
      managed_by: user.role === 'admin' && !body.managed_by ? user.id : body.managed_by
    };

    // Only superadmin can set managed_by to someone else
    if (user.role !== 'superadmin' && body.managed_by && body.managed_by !== user.id) {
      return NextResponse.json({ error: 'Only superadmin can assign events to other admins' }, { status: 403 });
    }

    // Create mock event (in real app, this would create in database)
    const newEvent = {
      id: `event-uuid-${Date.now()}`,
      ...eventData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json({
      ...newEvent,
      can_edit: true, // Creator can edit
      managed_by_email: newEvent.managed_by ? user.email : null
    });
  } catch (error: any) {
    console.error('[Events POST]', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

