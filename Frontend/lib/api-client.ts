/**
 * Centralized API call functions.
 * All HTTP requests live here — no fetch/axios calls anywhere else.
 * Hooks in lib/hooks/* consume these functions via TanStack Query.
 */

import api, { setAccessToken } from './api';

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  managed_by?: { id: string; email: string } | null;
  company_name?: string | null;
  is_verified: boolean;
  is_active: boolean;
  is_locked?: boolean;
  failed_login_attempts?: number;
  locked_until?: string | null;
  last_login?: string | null;
  last_login_ip?: string | null;
  date_joined?: string;
  profile?: {
    avatar?: string | null;
    bio?: string;
    phone?: string;
    timezone?: string;
    updated_at?: string;
  };
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  description?: string;
  status?: 'live' | 'offline' | 'maintenance';
  latency?: 'instant' | 'fast' | 'moderate' | 'slow';
  efficiency?: number;
  agent_type: 'chatbot' | 'assistant' | 'analyzer' | 'automation' | 'custom';
  is_active: boolean;
  config: Record<string, unknown>;
  created_at?: string;
  // present on my-agents endpoint (access record data)
  expires_at?: string | null;
  access_via?: 'direct' | 'group' | null;
  group_name?: string | null;
  // present on public endpoint
  has_access?: boolean;
  requires_auth?: boolean;
}

export interface AdminAgent extends Agent {
  agent_id: string;
  is_expired: boolean;
  granted_by: string;
  granted_at: string;
  assigned_to_users: number;
  assigned_to_groups: number;
}

export interface AgentAccess {
  id: string;
  user: { id: string; email: string };
  granted_by?: { email: string };
  expires_at: string | null;
  is_active: boolean;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export interface LoginResponse {
  access: string;
  user: ApiUser;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  registerAdmin: async (data: { email: string; password: string; password_confirm: string; organization_name: string }) => {
    const res = await api.post('/api/v1/auth/register/admin/', data);
    return res.data;
  },

  // ── Invite-link flow ───────────────────────────────────────────────────────
  validateInviteToken: async (token: string): Promise<{ email: string; invited_by: string; expires_at: string }> => {
    const res = await api.get(`/api/v1/auth/invite/validate/?token=${token}`);
    return res.data?.data ?? res.data;
  },

  completeInvite: async (data: {
    token: string;
    first_name: string;
    last_name: string;
    phone?: string;
    password: string;
    password_confirm: string;
  }) => {
    const res = await api.post('/api/v1/auth/invite/complete/', data);
    return res.data;
  },

  verifyOTP: async (data: { email: string; otp_code: string }) => {
    const res = await api.post('/api/v1/auth/verify-otp/', data);
    return res.data;
  },

  resendOTP: async (data: { email: string }) => {
    const res = await api.post('/api/v1/auth/resend-otp/', data);
    return res.data;
  },

  login: async (data: { email: string; password: string }): Promise<LoginResponse> => {
    const res = await api.post('/api/v1/auth/login/', data);
    // Handle both mock and real API responses
    let apiData;
    
    if (res.data.data) {
      // Mock API response structure
      apiData = res.data.data;
    } else if (res.data.access && res.data.user) {
      // Real API response structure
      apiData = res.data;
    } else {
      throw new Error('Invalid API response structure');
    }
    
    const { access, user } = apiData;
    setAccessToken(access);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
    return { access, user };
  },

  logout: async () => {
    const res = await api.post('/api/v1/auth/logout/', {});
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    return res.data;
  },

  verifyEmail: async (data: { uid: string; token: string }) => {
    const res = await api.post('/api/v1/auth/verify-email/', data);
    return res.data;
  },

  resendVerification: async (data: { email: string }) => {
    const res = await api.post('/api/v1/auth/resend-verification/', data);
    return res.data;
  },

  forgotPassword: async (data: { email: string }) => {
    const res = await api.post('/api/v1/auth/forgot-password/', data);
    return res.data;
  },

  resetPassword: async (data: {
    uid: string;
    token: string;
    new_password: string;
    new_password_confirm: string;
  }) => {
    const res = await api.post('/api/v1/auth/reset-password/', data);
    return res.data;
  },

  changePassword: async (data: {
    old_password: string;
    new_password: string;
    new_password_confirm: string;
  }) => {
    const res = await api.post('/api/v1/auth/change-password/', data);
    const newToken: string | undefined = res.data?.data?.access;
    if (newToken) setAccessToken(newToken);
    return res.data;
  },

  refreshToken: async () => {
    const res = await api.post('/api/v1/auth/token/refresh/');
    return res.data?.data?.access as string;
  },
};

// ─── Users (admin) ────────────────────────────────────────────────────────────

export interface ListUsersParams {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  is_active?: string;
  is_verified?: string;
}

export interface UserAgentAccess {
  agent_id: string;
  name: string;
  description?: string;
  slug: string;
  agent_type: string;
  agent_is_active: boolean;
  has_access: boolean;
  access_is_active: boolean;
  access_is_expired: boolean;
  expires_at: string | null;
  granted_by: string | null;
}

export interface AccessDiagnostic {
  user: {
    id: string;
    email: string;
    is_active: boolean;
    is_locked: boolean;
    managed_by: { id: string; email: string } | null;
  };
  summary: {
    total_agents: number;
    accessible: number;
    blocked: number;
    no_access_granted: number;
  };
  agents: {
    agent_id: string;
    agent_name: string;
    agent_is_active: boolean;
    has_access: boolean;
    access_via: 'direct' | 'group' | null;
    direct_access: {
      exists: boolean;
      is_active: boolean;
      expires_at: string | null;
      is_expired: boolean;
    };
    group_access: Array<{
      group_id: string;
      group_name: string;
      is_active: boolean;
    }>;
    block_reasons: string[];
  }[];
}

export const usersApi = {
  list: async (params: ListUsersParams = {}): Promise<PaginatedResponse<ApiUser>> => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    const res = await api.get(`/api/v1/users/?${q}`);
    return res.data;
  },

  invite: async (data: { email: string; managed_by_id?: string | null }) => {
    const res = await api.post('/api/v1/users/invite/', data);
    return res.data;
  },

  get: async (id: string): Promise<ApiUser> => {
    const res = await api.get(`/api/v1/users/${id}/`);
    return res.data?.data ?? res.data;
  },

  updateRole: async (id: string, role: string) => {
    const res = await api.patch(`/api/v1/users/${id}/role/`, { role });
    return res.data;
  },

  assignManager: async (id: string, managed_by_id: string | null) => {
    const res = await api.patch(`/api/v1/users/${id}/assign-manager/`, { managed_by_id });
    return res.data;
  },

  activate: async (id: string) => {
    const res = await api.post(`/api/v1/users/${id}/activate/`);
    return res.data;
  },

  deactivate: async (id: string) => {
    const res = await api.post(`/api/v1/users/${id}/deactivate/`);
    return res.data;
  },

  lock: async (id: string, lockout_minutes: number) => {
    const res = await api.post(`/api/v1/users/${id}/lock/`, { lockout_minutes });
    return res.data;
  },

  unlock: async (id: string) => {
    const res = await api.post(`/api/v1/users/${id}/unlock/`);
    return res.data;
  },

  accessDiagnostic: async (id: string): Promise<AccessDiagnostic> => {
    const res = await api.get(`/api/v1/users/${id}/access-diagnostic/`);
    return res.data?.data ?? res.data;
  },

  // ─── Agent access ───────────────────────────────────────────────────────────

  userAgents: async (userId: string): Promise<{ user: { id: string; email: string }; agents: UserAgentAccess[] }> => {
    const res = await api.get(`/api/v1/users/${userId}/agents/`);
    return res.data?.data ?? res.data;
  },

  grantAgentAccess: async (userId: string, payload: { agent_id: string; expires_at?: string | null }) => {
    const res = await api.post(`/api/v1/users/${userId}/agents/grant/`, payload);
    return res.data;
  },

  toggleAgentAccess: async (userId: string, agentId: string) => {
    const res = await api.post(`/api/v1/users/${userId}/agents/${agentId}/toggle/`);
    return res.data;
  },

  userGroups: async (userId: string): Promise<{ id: string; name: string; is_active: boolean }[]> => {
    const res = await api.get(`/api/v1/users/${userId}/groups/`);
    const d = res.data;
    return Array.isArray(d) ? d : d.results ?? d.data ?? [];
  },

  assignCompany: async (userId: string, company_id: string | null): Promise<ApiUser> => {
    const res = await api.patch(`/api/v1/users/${userId}/assign-company/`, { company_id });
    return res.data?.data ?? res.data;
  },
};

// ─── Agents ────────────────────────────────────────────────────────────────────

export interface ListAgentsParams {
  page?: number;
  page_size?: number;
  search?: string;
  agent_type?: string;
  is_active?: boolean;
  status?: string;
}

export interface CreateAgentPayload {
  name: string;
  subtitle?: string;
  description?: string;
  status?: Agent['status'];
  latency?: Agent['latency'];
  efficiency?: number;
  agent_type?: Agent['agent_type'];
  config?: Record<string, unknown>;
  is_active?: boolean;
}

export const agentsApi = {
  list: async (params: ListAgentsParams = {}): Promise<PaginatedResponse<Agent>> => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    const res = await api.get(`/api/v1/agents/?${q}`);
    return res.data;
  },

  myAgents: async (): Promise<Agent[]> => {
    const res = await api.get('/api/v1/agents/my-agents/');
    const d = res.data;
    // Handle both wrapped and unwrapped response shapes
    if (d.results) return d.results;
    if (d.data) return Array.isArray(d.data) ? d.data : d.data.results ?? [];
    return Array.isArray(d) ? d : [];
  },

  adminMyAgents: async (): Promise<AdminAgent[]> => {
    try {
      // Try the admin-specific endpoint first
      const res = await api.get('/api/v1/users/my-agents/');
      const d = res.data;
      // Handle paginated response structure
      if (d.results) return d.results;
      if (d.data) return Array.isArray(d.data) ? d.data : d.data.results ?? [];
      return Array.isArray(d) ? d : [];
    } catch (error) {
      // Fallback to regular agents endpoint if admin endpoint doesn't exist
      console.warn('Admin my-agents endpoint not found, falling back to regular agents');
      const res = await api.get('/api/v1/agents/');
      const d = res.data;
      const agents = d.results || d.data || [];
      // Transform regular agents to AdminAgent format
      return agents.map((agent: any) => ({
        ...agent,
        agent_id: agent.id,
        is_expired: false,
        granted_by: 'superadmin@gmail.com',
        granted_at: new Date().toISOString(),
        assigned_to_users: 0,
        assigned_to_groups: 0
      }));
    }
  },

  get: async (slug: string): Promise<Agent> => {
    const res = await api.get(`/api/v1/agents/${slug}/`);
    return res.data?.data ?? res.data;
  },

  create: async (payload: CreateAgentPayload): Promise<Agent> => {
    const res = await api.post('/api/v1/agents/', payload);
    return res.data?.data ?? res.data;
  },

  update: async (slug: string, payload: Partial<CreateAgentPayload>): Promise<Agent> => {
    const res = await api.patch(`/api/v1/agents/${slug}/`, payload);
    return res.data?.data ?? res.data;
  },

  delete: async (slug: string) => {
    await api.delete(`/api/v1/agents/${slug}/`);
  },

  toggleStatus: async (slug: string): Promise<{ is_active: boolean }> => {
    const res = await api.post(`/api/v1/agents/${slug}/toggle-status/`);
    return res.data?.data ?? res.data;
  },

  publicList: async (params: ListAgentsParams = {}): Promise<PaginatedResponse<Agent>> => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    const res = await api.get(`/api/v1/agents/public/?${q}`);
    return res.data;
  },

  listAccess: async (slug: string, page = 1): Promise<PaginatedResponse<AgentAccess>> => {
    const res = await api.get(`/api/v1/agents/${slug}/access/?page=${page}`);
    return res.data;
  },

  grantAccess: async (slug: string, payload: { user_id: string; expires_at?: string | null }) => {
    const res = await api.post(`/api/v1/agents/${slug}/access/`, payload);
    return res.data;
  },

  revokeAccess: async (slug: string, userId: string) => {
    await api.delete(`/api/v1/agents/${slug}/access/${userId}/`);
  },
};

// ─── Groups ────────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  member_count: number;
  agent_count: number;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  membership_id: string;
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  added_by: string;
  joined_at: string;
}

export interface GroupAgent {
  access_id: string;
  agent_id: string;
  name: string;
  subtitle?: string;
  slug: string;
  agent_type: string;
  status: 'live' | 'offline' | 'maintenance';
  agent_is_active: boolean;
  granted_by: string;
  granted_at: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_by: string;
  members: GroupMember[];
  agents: GroupAgent[];
}

export interface ListGroupsParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  is_active?: boolean;
}

export const groupsApi = {
  list: async (params: ListGroupsParams = {}): Promise<PaginatedResponse<Group>> => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    const res = await api.get(`/api/v1/groups/?${q}`);
    return res.data;
  },

  myGroups: async (): Promise<Group[]> => {
    const res = await api.get('/api/v1/groups/my-groups/');
    const d = res.data;
    if (d.results) return d.results;
    if (d.data) return Array.isArray(d.data) ? d.data : [];
    return Array.isArray(d) ? d : [];
  },

  get: async (id: string): Promise<GroupDetail> => {
    const res = await api.get(`/api/v1/groups/${id}/`);
    return res.data?.data ?? res.data;
  },

  create: async (payload: CreateGroupPayload): Promise<Group> => {
    const res = await api.post('/api/v1/groups/', payload);
    return res.data?.data ?? res.data;
  },

  update: async (id: string, payload: Partial<CreateGroupPayload>): Promise<Group> => {
    const res = await api.patch(`/api/v1/groups/${id}/`, payload);
    return res.data?.data ?? res.data;
  },

  delete: async (id: string) => {
    await api.delete(`/api/v1/groups/${id}/`);
  },

  toggle: async (id: string): Promise<{ is_active: boolean; message: string }> => {
    const res = await api.post(`/api/v1/groups/${id}/toggle/`);
    return res.data?.data ?? res.data;
  },

  addMembers: async (id: string, user_ids: string[]): Promise<{ added: number; reactivated: number }> => {
    const res = await api.post(`/api/v1/groups/${id}/members/`, { user_ids });
    return res.data?.data ?? res.data;
  },

  removeMember: async (id: string, userId: string) => {
    await api.delete(`/api/v1/groups/${id}/members/${userId}/`);
  },

  assignAgents: async (id: string, agent_ids: string[]): Promise<{ added: number; reactivated: number }> => {
    const res = await api.post(`/api/v1/groups/${id}/agents/`, { agent_ids });
    return res.data?.data ?? res.data;
  },

  removeAgent: async (id: string, agentId: string) => {
    await api.delete(`/api/v1/groups/${id}/agents/${agentId}/`);
  },
};

// ─── Company ───────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  location: string;
  website: string;
  email: string;
  timezone: string;
  mission: string;
  pillars: string[];
  services: string[];
  who_we_serve: string[];
  process: string[];
  system_prompt: string;
  managed_by: string | null;
  managed_by_email: string | null;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateCompanyPayload = Omit<Company, 'id' | 'created_at' | 'updated_at' | 'managed_by_email' | 'can_edit'>;
export type UpdateCompanyPayload = Partial<CreateCompanyPayload>;

export const companyApi = {
  list: async (): Promise<Company[]> => {
    const res = await api.get('/api/v1/company/');
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  get: async (id: string): Promise<Company> => {
    const res = await api.get(`/api/v1/company/${id}/`);
    return res.data?.data ?? res.data;
  },

  create: async (payload: CreateCompanyPayload): Promise<Company> => {
    const res = await api.post('/api/v1/company/', payload);
    return res.data?.data ?? res.data;
  },

  update: async (id: string, payload: UpdateCompanyPayload): Promise<Company> => {
    const res = await api.put(`/api/v1/company/${id}/`, payload);
    return res.data?.data ?? res.data;
  },

  assignAdmin: async (id: string, managed_by: string | null): Promise<Company> => {
    const res = await api.post(`/api/v1/company/${id}/assign-admin/`, { managed_by });
    return res.data?.data ?? res.data;
  },
};

// ─── Organizations ─────────────────────────────────────────────────────────────

export interface OrgPlan {
  tier: string;
  display_name: string;
  max_users: number;
  max_agents: number;
  price_usd_monthly: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  plan: OrgPlan;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  user_email: string;
  is_active: boolean;
  joined_at: string;
}

export interface OrgAgent {
  id: string;
  name: string;
  subtitle?: string;
  agent_type: string;
  status?: 'live' | 'offline' | 'maintenance';
  is_blocked_by_superadmin: boolean;
  integration_connected: boolean;
  users_with_access: number;
  // subscription fields (present on GET /organizations/me/agents/)
  is_subscribed?: boolean;
  subscription_type?: 'self' | 'superadmin' | null;
  can_subscribe?: boolean;
}

export interface AgentPermission {
  id: string;
  user: string;
  user_email: string;
  agent: string;
  agent_name: string;
  is_active: boolean;
  created_at: string;
}

export interface OrgAgentAccess {
  id: string;
  agent: string;
  agent_name: string;
  agent_slug: string;
  is_enabled: boolean;
  enabled_at: string | null;
  disabled_by_email: string | null;
  disabled_at: string | null;
  notes: string;
}

export const organizationsApi = {
  getMyOrg: async (): Promise<Organization> => {
    const res = await api.get('/api/v1/organizations/me/');
    return res.data?.data ?? res.data;
  },

  getMyOrgStats: async (): Promise<{ member_count: number; group_count: number; subscribed_agent_count: number }> => {
    const res = await api.get('/api/v1/organizations/me/stats/');
    return res.data?.data ?? res.data;
  },

  updateMyOrg: async (data: { name: string }): Promise<Organization> => {
    const res = await api.patch('/api/v1/organizations/me/', data);
    return res.data?.data ?? res.data;
  },

  listMembers: async (): Promise<OrgMember[]> => {
    const res = await api.get('/api/v1/organizations/me/members/');
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  listAgents: async (): Promise<OrgAgent[]> => {
    const res = await api.get('/api/v1/organizations/me/agents/');
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  listAgentPermissions: async (): Promise<AgentPermission[]> => {
    const res = await api.get('/api/v1/organizations/me/agent-permissions/');
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  grantAgentPermission: async (data: { user_id: string; agent_id: string }): Promise<AgentPermission> => {
    const res = await api.post('/api/v1/organizations/me/agent-permissions/', data);
    return res.data?.data ?? res.data;
  },

  revokeAgentPermission: async (permissionId: string): Promise<void> => {
    await api.delete(`/api/v1/organizations/me/agent-permissions/${permissionId}/`);
  },

  // Superadmin: list all orgs
  listAll: async (): Promise<Organization[]> => {
    const res = await api.get('/api/v1/organizations/');
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  // Superadmin: update org (activate/deactivate, rename)
  updateById: async (orgId: string, data: { is_active?: boolean; name?: string }): Promise<Organization> => {
    const res = await api.patch(`/api/v1/organizations/${orgId}/`, data);
    return res.data?.data ?? res.data;
  },

  // Superadmin: get per-org agent kill-switch list
  listOrgAgentAccess: async (orgId: string): Promise<OrgAgentAccess[]> => {
    const res = await api.get(`/api/v1/organizations/${orgId}/agents/`);
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  // Superadmin: toggle agent for org
  toggleOrgAgent: async (orgId: string, agentId: string, data: { is_enabled: boolean; notes?: string }) => {
    const res = await api.post(`/api/v1/organizations/${orgId}/agents/${agentId}/toggle/`, data);
    return res.data?.data ?? res.data;
  },

  // Admin: subscribe own org to an agent
  subscribeAgent: async (agentId: string) => {
    const res = await api.post(`/api/v1/organizations/me/agents/${agentId}/subscribe/`);
    return res.data?.data ?? res.data;
  },

  // Admin: unsubscribe own org from an agent
  unsubscribeAgent: async (agentId: string) => {
    await api.delete(`/api/v1/organizations/me/agents/${agentId}/subscribe/`);
  },
};

// ─── Integrations ──────────────────────────────────────────────────────────────

export interface ProviderOAuthConfig {
  auth_url: string;
  token_url: string;
  scopes: string[];
  client_id_setting: string;
  client_secret_setting: string;
  extra_params?: Record<string, string>;
}

export interface IntegrationProvider {
  id: string;
  agent: string;
  agent_name: string;
  provider: string;
  display_name: string;
  logo_url?: string;
  auth_type: 'oauth2' | 'apikey';
  field_schema: Array<{ name: string; label: string; type: string }>;
  oauth_config?: ProviderOAuthConfig;
}

export interface IntegrationCredential {
  id: string;
  provider_name: string;
  provider_slug: string;
  agent_name: string;
  is_active: boolean;
  is_expired: boolean;
  token_expiry?: string;
  connected_by_email: string;
  created_at?: string;
}

export const integrationsApi = {
  listProviders: async (agentId?: string): Promise<IntegrationProvider[]> => {
    const q = agentId ? `?agent=${agentId}` : '';
    const res = await api.get(`/api/v1/integrations/providers/${q}`);
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  getOAuthUrl: async (providerId: string): Promise<{ auth_url: string }> => {
    const res = await api.get(`/api/v1/integrations/${providerId}/connect/`);
    return res.data?.data ?? res.data;
  },

  connectApiKey: async (data: { provider_id: string; credentials: Record<string, string> }): Promise<IntegrationCredential> => {
    const res = await api.post('/api/v1/integrations/connect/apikey/', data);
    return res.data?.data ?? res.data;
  },

  listCredentials: async (): Promise<IntegrationCredential[]> => {
    const res = await api.get('/api/v1/integrations/credentials/');
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  disconnect: async (credentialId: string): Promise<void> => {
    await api.delete(`/api/v1/integrations/credentials/${credentialId}/disconnect/`);
  },

  updateMessengerConfig: async (data: {
    agent_slug: string;
    default_channel: string;
    messenger: string;
  }): Promise<void> => {
    await api.patch('/api/v1/integrations/messenger-config/', data);
  },

  // ─── Gmail OAuth ───────────────────────────────────────────────────────────

  getGmailOAuthUrl: async (): Promise<{ auth_url: string }> => {
    const res = await api.get('/api/v1/integrations/gmail/connect/');
    return res.data?.data ?? res.data;
  },

  getGmailStatus: async (): Promise<{ connected: boolean; gmail_email: string | null }> => {
    const res = await api.get('/api/v1/integrations/gmail/status/');
    return res.data?.data ?? res.data;
  },

  disconnectGmail: async (): Promise<void> => {
    await api.delete('/api/v1/integrations/gmail/disconnect/');
  },


  // ─── Superadmin: manage providers ──────────────────────────────────────────

  createAdminProvider: async (data: {
    agent: string;
    provider: string;
    display_name?: string;
    logo_url?: string;
    auth_type: 'oauth2' | 'apikey';
    field_schema?: Array<{ name: string; label: string; type: string }>;
    oauth_config?: ProviderOAuthConfig;
  }): Promise<IntegrationProvider> => {
    const res = await api.post('/api/v1/integrations/admin/providers/', data);
    return res.data?.data ?? res.data;
  },

  updateAdminProvider: async (providerId: string, data: {
    display_name?: string;
    auth_type?: 'oauth2' | 'apikey';
    oauth_config?: ProviderOAuthConfig;
    field_schema?: Array<{ name: string; label: string; type: string }>;
  }): Promise<IntegrationProvider> => {
    const res = await api.patch(`/api/v1/integrations/admin/providers/${providerId}/`, data);
    return res.data?.data ?? res.data;
  },

  deleteAdminProvider: async (providerId: string): Promise<void> => {
    await api.delete(`/api/v1/integrations/admin/providers/${providerId}/`);
  },

  listAdminProviders: async (agentId?: string): Promise<IntegrationProvider[]> => {
    const q = agentId ? `?agent=${agentId}` : '';
    const res = await api.get(`/api/v1/integrations/admin/providers/${q}`);
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },
};

// ─── Events ────────────────────────────────────────────────────────────────────

export interface CompanyEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  timezone: string;
  format: string;
  is_active: boolean;
  managed_by: string | null;
  managed_by_email: string | null;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export type EventPayload = {
  title: string;
  description: string;
  date: string;
  time: string;
  timezone: string;
  format: string;
  is_active: boolean;
  managed_by?: string | null;
};

// ─── Usage tracking ────────────────────────────────────────────────────────────

export interface UsageAgentStat {
  agent_id: string;
  agent_name: string;
  agent_slug: string;
  minutes_used: number;
  limit_minutes: number | null;
}

export interface AdminUsageStats {
  by_agent: { agent_id: string; agent_name: string; agent_slug: string; total_minutes: number }[];
  by_user: {
    user_id: string;
    user_email: string;
    agents: { agent_id: string; agent_name: string; minutes_used: number; limit_minutes?: number | null }[];
  }[];
}

export interface TimeLimit {
  id: string;
  agent_id: string;
  agent_name: string;
  target_user_id: string;
  target_user_email: string;
  limit_minutes: number;
}

export const usageApi = {
  startSession: async (agent_slug: string): Promise<{ session_id: string; limit_minutes: number | null; used_minutes: number }> => {
    const res = await api.post('/api/v1/usage/sessions/start/', { agent_slug });
    return res.data?.data ?? res.data;
  },

  heartbeat: async (session_id: string): Promise<{ seconds_active: number; minutes_active: number; limit_exceeded: boolean; limit_minutes: number | null }> => {
    const res = await api.post(`/api/v1/usage/sessions/${session_id}/heartbeat/`);
    return res.data?.data ?? res.data;
  },

  endSession: async (session_id: string): Promise<void> => {
    await api.post(`/api/v1/usage/sessions/${session_id}/end/`);
  },

  myStats: async (): Promise<UsageAgentStat[]> => {
    const res = await api.get('/api/v1/usage/my/');
    return res.data?.data ?? res.data;
  },

  checkLimit: async (slug: string): Promise<{ limit_minutes: number | null; used_minutes: number; is_blocked: boolean }> => {
    const res = await api.get(`/api/v1/usage/check/${slug}/`);
    return res.data?.data ?? res.data;
  },

  adminStats: async (): Promise<AdminUsageStats> => {
    const res = await api.get('/api/v1/usage/admin/');
    return res.data?.data ?? res.data;
  },

  getLimits: async (): Promise<TimeLimit[]> => {
    const res = await api.get('/api/v1/usage/limits/');
    return res.data?.data ?? res.data;
  },

  setLimit: async (data: { agent_id: string; target_user_id: string; limit_minutes: number }): Promise<TimeLimit> => {
    const res = await api.post('/api/v1/usage/limits/', data);
    return res.data?.data ?? res.data;
  },

  deleteLimit: async (limit_id: string): Promise<void> => {
    await api.delete(`/api/v1/usage/limits/${limit_id}/`);
  },
};

// ─── Admin registrations & members ────────────────────────────────────────────

export interface AdminRegistration {
  id: string;
  email: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string;
  date_joined: string;
  is_active: boolean;
  first_name: string;
  last_name: string;
  member_count: number;
}

export interface InviteMember {
  invite_id: string;
  email: string;
  invited_role: string;
  signup_status: 'pending' | 'accepted';
  user_id: string | null;
  date_joined: string | null;
  invited_at: string;
  expires_at: string;
  is_expired: boolean;
  token: string;
}

export const registrationsApi = {
  list: async (): Promise<{ pending: AdminRegistration[]; approved: AdminRegistration[]; rejected: AdminRegistration[]; counts: Record<string, number> }> => {
    const res = await api.get('/api/v1/auth/superadmin/registrations/');
    return res.data?.data ?? res.data;
  },
  decide: async (admin_id: string, action: 'approve' | 'reject', reason?: string): Promise<void> => {
    await api.post(`/api/v1/auth/superadmin/registrations/${admin_id}/decide/`, { action, reason });
  },
};

export const membersApi = {
  list: async (): Promise<{ members: InviteMember[]; counts: Record<string, number> }> => {
    const res = await api.get('/api/v1/auth/admin/members/');
    return res.data?.data ?? res.data;
  },
  resend: async (invite_id: string): Promise<void> => {
    await api.post(`/api/v1/auth/admin/members/${invite_id}/resend/`);
  },
};

export const eventsApi = {
  list: async (): Promise<CompanyEvent[]> => {
    const res = await api.get('/api/v1/company/events/');
    const d = res.data;
    return Array.isArray(d) ? d : d.data ?? d.results ?? [];
  },

  get: async (id: string): Promise<CompanyEvent> => {
    const res = await api.get(`/api/v1/company/events/${id}/`);
    return res.data?.data ?? res.data;
  },

  create: async (payload: EventPayload): Promise<CompanyEvent> => {
    const res = await api.post('/api/v1/company/events/', payload);
    return res.data?.data ?? res.data;
  },

  update: async (id: string, payload: Partial<EventPayload>): Promise<CompanyEvent> => {
    const res = await api.put(`/api/v1/company/events/${id}/`, payload);
    return res.data?.data ?? res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/company/events/${id}/`);
  },

  toggle: async (id: string): Promise<CompanyEvent> => {
    const res = await api.post(`/api/v1/company/events/${id}/toggle/`);
    return res.data?.data ?? res.data;
  },
};
