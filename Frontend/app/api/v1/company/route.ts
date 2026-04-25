import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, canEditResource } from '@/lib/auth-utils';

// Mock company data (replace with actual API calls)
const mockCompanyData = {
  id: "company-uuid",
  name: "Life Science AI",
  location: "Level 1, 9 The Esplanade, Perth WA 6000, Australia",
  website: "lifescienceai.com.au",
  email: "connect@lifescienceai.com.au",
  timezone: "Perth, Australia (AWST, UTC+8)",
  mission: "Empower professionals and organisations with practical AI tools...",
  pillars: [
    "Data with Integrity — transparency and ethical governance",
    "Minds with Curiosity — nurturing learning, creativity, and critical thinking",
    "Wellbeing with Compassion — designing AI to uplift health and happiness"
  ],
  services: [
    "AI Education & Capability Building — CPD-accredited training, workshops",
    "AI Strategy & Implementation — practical AI strategies aligned with goals",
    "Data-Driven Health & Wellbeing Solutions — population health tools",
    "Innovation Partnerships — collaborations with universities and startups",
    "Data & Analytics — reliable data infrastructure, advanced analytics",
    "Healthcare AI Solutions — medical imaging, predictive analytics",
    "Automation & Workflow Optimisation — AI-driven automation"
  ],
  who_we_serve: [
    "Healthcare providers, hospitals, clinics",
    "Government health departments",
    "Life science and biotech firms",
    "Universities and research organisations",
    "Corporate organisations focused on workforce wellbeing",
    "Private enterprises"
  ],
  process: [
    "Step 1 — Initial Conversation: Explore goals and challenges",
    "Step 2 — Implementation: Safe integration of AI tools",
    "Step 3 — Continued Training & Support: Six months of guidance",
    "Step 4 — Ongoing Support: Monthly check-ins and performance reviews"
  ],
  system_prompt: "You are AVA — AI Reception & Inquiry Assistant for Life Science AI...",
  managed_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};

// Company data interface
interface CompanyData {
  name?: string;
  location?: string;
  website?: string;
  email?: string;
  timezone?: string;
  mission?: string;
  pillars?: string[];
  services?: string[];
  who_we_serve?: string[];
  process?: string[];
  system_prompt?: string;
  managed_by?: string | null; // Only superadmin can change
}

// GET /api/v1/company/ - Get company info with edit permissions
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    
    if (error || !user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    // Superadmin can edit everything
    const canEdit = user.role === 'superadmin' || 
                   (user.role === 'admin' && (!mockCompanyData.managed_by || mockCompanyData.managed_by === user.id));

    return NextResponse.json({
      ...mockCompanyData,
      can_edit: canEdit,
      managed_by_email: mockCompanyData.managed_by ? user.email : null
    });
  } catch (error: any) {
    console.error('[Company GET]', error);
    return NextResponse.json(
      { error: 'Failed to fetch company information' },
      { status: 500 }
    );
  }
}

// PUT /api/v1/company/ - Update company info with role-based permissions
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, error } = await authenticateRequest(request);
    
    if (error || !user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Admin can only edit if they're assigned or if unassigned
    if (user.role === 'admin' && mockCompanyData.managed_by && mockCompanyData.managed_by !== user.id) {
      return NextResponse.json({ error: 'You can only edit company info assigned to you' }, { status: 403 });
    }

    // Only superadmin can change managed_by field
    const updateData: CompanyData = { ...body };
    if (user.role !== 'superadmin') {
      delete updateData.managed_by;
    }

    // Update mock data (in real app, this would update the database)
    const updatedData = { ...mockCompanyData, ...updateData, updated_at: new Date().toISOString() };

    return NextResponse.json({
      ...updatedData,
      can_edit: true, // User just edited, so they can edit
      managed_by_email: updatedData.managed_by ? user.email : null
    });
  } catch (error: any) {
    console.error('[Company PUT]', error);
    return NextResponse.json(
      { error: 'Failed to update company information' },
      { status: 500 }
    );
  }
}
