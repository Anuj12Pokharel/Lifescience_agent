'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLogout } from '@/lib/hooks/use-auth';
import { useAllOrgs, useToggleOrgAgent } from '@/lib/hooks/use-organizations';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  agentsApi, integrationsApi, organizationsApi, usersApi, registrationsApi, usageApi,
  type Organization, type Agent, type IntegrationProvider,
  type CreateAgentPayload, type OrgAgentAccess, type ApiUser, type AccessDiagnostic,
  type AdminRegistration, type TimeLimit,
} from '@/lib/api-client';
import {
  Building2, Bot, Users, ShieldAlert, LogOut, Power, PowerOff,
  ChevronDown, ChevronRight, Plus, Trash2, Plug, Key, Settings2,
  Pencil, Lock, Unlock, UserCog, BarChart2, Search, ShieldOff, Shield,
  CheckCircle2, AlertCircle, XCircle, RefreshCw, Clock, Menu, X,
  LayoutDashboard, UserCheck, BarChart3, TrendingUp, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OAuthFormConfig {
  auth_url: string; token_url: string; scopes: string;
  client_id_setting: string; client_secret_setting: string; extra_params: string;
}
interface ProviderFormState {
  provider: string; display_name: string; logo_url: string;
  auth_type: 'oauth2' | 'apikey'; oauth_config: OAuthFormConfig;
  field_schema_raw: string;
}

type NavSection = 'overview' | 'agents' | 'organizations' | 'users' | 'registrations' | 'usage';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const scopesToArray = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
const extraParamsToRecord = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {};
  raw.split('\n').forEach((line) => { const i = line.indexOf('='); if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); });
  return out;
};
const recordToLines = (rec?: Record<string, string>) =>
  rec ? Object.entries(rec).map(([k, v]) => `${k}=${v}`).join('\n') : '';
const oauthFormFromProvider = (p: IntegrationProvider): OAuthFormConfig => ({
  auth_url: p.oauth_config?.auth_url ?? '',
  token_url: p.oauth_config?.token_url ?? '',
  scopes: (p.oauth_config?.scopes ?? []).join(' '),
  client_id_setting: p.oauth_config?.client_id_setting ?? '',
  client_secret_setting: p.oauth_config?.client_secret_setting ?? '',
  extra_params: recordToLines(p.oauth_config?.extra_params),
});

const PRESETS: Array<{ provider: string; display_name: string; auth_type: 'oauth2' | 'apikey'; oauth_config?: OAuthFormConfig; field_schema?: Array<Record<string, unknown>> }> = [
  { provider: 'jira',       display_name: 'Jira',       auth_type: 'oauth2', oauth_config: { auth_url: 'https://auth.atlassian.com/authorize', token_url: 'https://auth.atlassian.com/oauth/token', scopes: 'read:jira-work write:jira-work read:jira-user offline_access', client_id_setting: 'JIRA_CLIENT_ID', client_secret_setting: 'JIRA_CLIENT_SECRET', extra_params: 'audience=api.atlassian.com\nprompt=consent' } },
  { provider: 'asana',      display_name: 'Asana',      auth_type: 'oauth2', oauth_config: { auth_url: 'https://app.asana.com/-/oauth_authorize', token_url: 'https://app.asana.com/-/oauth_token', scopes: 'default', client_id_setting: 'ASANA_CLIENT_ID', client_secret_setting: 'ASANA_CLIENT_SECRET', extra_params: '' } },
  { provider: 'github',     display_name: 'GitHub',     auth_type: 'oauth2', oauth_config: { auth_url: 'https://github.com/login/oauth/authorize', token_url: 'https://github.com/login/oauth/access_token', scopes: 'repo read:user', client_id_setting: 'GITHUB_CLIENT_ID', client_secret_setting: 'GITHUB_CLIENT_SECRET', extra_params: '' } },
  { provider: 'slack',      display_name: 'Slack',      auth_type: 'oauth2', oauth_config: { auth_url: 'https://slack.com/oauth/v2/authorize', token_url: 'https://slack.com/api/oauth.v2.access', scopes: 'channels:read chat:write', client_id_setting: 'SLACK_CLIENT_ID', client_secret_setting: 'SLACK_CLIENT_SECRET', extra_params: '' } },
  { provider: 'notion',     display_name: 'Notion',     auth_type: 'oauth2', oauth_config: { auth_url: 'https://api.notion.com/v1/oauth/authorize', token_url: 'https://api.notion.com/v1/oauth/token', scopes: '', client_id_setting: 'NOTION_CLIENT_ID', client_secret_setting: 'NOTION_CLIENT_SECRET', extra_params: '' } },
  { provider: 'hubspot',    display_name: 'HubSpot',    auth_type: 'oauth2', oauth_config: { auth_url: 'https://app.hubspot.com/oauth/authorize', token_url: 'https://api.hubapi.com/oauth/v1/token', scopes: 'crm.objects.contacts.read', client_id_setting: 'HUBSPOT_CLIENT_ID', client_secret_setting: 'HUBSPOT_CLIENT_SECRET', extra_params: '' } },
  { provider: 'salesforce', display_name: 'Salesforce', auth_type: 'oauth2', oauth_config: { auth_url: 'https://login.salesforce.com/services/oauth2/authorize', token_url: 'https://login.salesforce.com/services/oauth2/token', scopes: 'api refresh_token', client_id_setting: 'SALESFORCE_CLIENT_ID', client_secret_setting: 'SALESFORCE_CLIENT_SECRET', extra_params: '' } },
  { provider: 'gohighlevel', display_name: 'GoHighLevel', auth_type: 'apikey', field_schema: [{ name: 'api_key', label: 'API Key', type: 'password', optional: false }, { name: 'location_id', label: 'Location ID', type: 'text', optional: false }] },
  { provider: 'trello',     display_name: 'Trello',     auth_type: 'apikey' },
  { provider: 'airtable',   display_name: 'Airtable',   auth_type: 'apikey' },
  { provider: 'custom',     display_name: 'Custom',     auth_type: 'apikey' },
];

const BLANK_OAUTH: OAuthFormConfig = { auth_url: '', token_url: '', scopes: '', client_id_setting: '', client_secret_setting: '', extra_params: '' };
const BLANK_AGENT: CreateAgentPayload = { name: '', subtitle: '', description: '', agent_type: 'automation', status: 'live', is_active: true };
const BLANK_PROVIDER: ProviderFormState = { provider: '', display_name: '', logo_url: '', auth_type: 'apikey', oauth_config: { ...BLANK_OAUTH }, field_schema_raw: '' };

// ─── Shared style tokens ──────────────────────────────────────────────────────
const S = {
  label: { fontSize: 11, fontWeight: 700, color: 'rgba(120,170,220,0.6)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 5, display: 'block' },
  th:    { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(120,170,220,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid rgba(0,100,180,0.15)', whiteSpace: 'nowrap' as const, textAlign: 'left' as const },
  td:    { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(0,100,180,0.07)', verticalAlign: 'middle' as const },
  card:  { borderRadius: 12, background: 'rgba(0,15,40,0.8)', border: '1px solid rgba(0,100,180,0.18)', padding: '18px 20px' },
  btn:   { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, background: 'rgba(0,150,255,0.12)', border: '1px solid rgba(0,150,255,0.25)', color: '#00D4FF', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};

const roleBadge = (role: string) => {
  const map: Record<string, string> = { superadmin: '#FFB400', admin: '#A78BFA', user: '#00D4FF' };
  const c = map[role] ?? '#888';
  return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: `${c}18`, color: c, border: `1px solid ${c}30`, fontWeight: 700 }}>{role}</span>;
};

// ─── Registration helpers ─────────────────────────────────────────────────────
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const regStatusBadge = (status: AdminRegistration['approval_status']) => {
  const styles: Record<string, React.CSSProperties> = {
    approved: { fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(0,200,100,0.12)', color: '#00CC66', border: '1px solid rgba(0,200,100,0.3)', fontWeight: 700 },
    rejected:  { fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,60,60,0.1)', color: '#FF6060', border: '1px solid rgba(255,60,60,0.3)', fontWeight: 700 },
    pending:   { fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,180,0,0.1)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.3)', fontWeight: 700 },
  };
  return <span style={styles[status] ?? styles.pending}>{status}</span>;
};

function AdminRegRow({ reg, onDecide }: { reg: AdminRegistration; onDecide: (r: AdminRegistration, action: 'approve' | 'reject') => void }) {
  const name = [reg.first_name, reg.last_name].filter(Boolean).join(' ') || '—';
  return (
    <tr onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,100,180,0.05)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <td style={S.td}>
        <div style={{ fontWeight: 600, color: '#E8F4FF' }}>{reg.email}</div>
        {name !== '—' && <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>{name}</div>}
      </td>
      <td style={S.td}>{regStatusBadge(reg.approval_status)}</td>
      <td style={S.td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'rgba(120,170,220,0.7)' }}><Users size={13} /> {reg.member_count ?? 0}</span></td>
      <td style={S.td}><span style={{ color: 'rgba(120,170,220,0.6)' }}>{fmtDate(reg.date_joined)}</span></td>
      <td style={{ ...S.td, textAlign: 'right' as const }}>
        {reg.approval_status === 'pending' ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => onDecide(reg, 'approve')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.3)', color: '#00CC66', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><CheckCircle2 size={13} /> Approve</button>
            <button onClick={() => onDecide(reg, 'reject')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.25)', color: '#FF6060', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><XCircle size={13} /> Reject</button>
          </div>
        ) : <span style={{ fontSize: 12, color: 'rgba(120,170,220,0.35)' }}>—</span>}
      </td>
    </tr>
  );
}

// ── Sidebar nav item ──────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, badge, onClick }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; active?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px',
        borderRadius: 9, border: 'none', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s',
        background: active ? 'rgba(255,180,0,0.1)' : 'transparent',
        borderLeft: active ? '2px solid #FFB400' : '2px solid transparent',
      }}
    >
      <Icon size={16} color={active ? '#FFB400' : 'rgba(120,170,220,0.55)'} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#FFB400' : 'rgba(160,200,240,0.7)' }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(255,180,0,0.18)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.3)' }}>{badge}</span>
      )}
    </button>
  );
}

// ─── Link nav item (external page) ────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
export default function SuperadminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const logout = useLogout();
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'superadmin') router.push('/admin/dashboard');
  }, [user, loading, router]);

  // ── Shared data ──────────────────────────────────────────────────────────────
  const { data: orgs = [], isLoading: orgsLoading } = useAllOrgs();
  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => agentsApi.list({ page_size: 100 }),
    select: (d) => d.results ?? [],
    enabled: !!user,
  });
  const { data: registrationsData } = useQuery({
    queryKey: ['superadmin-registrations'],
    queryFn: registrationsApi.list,
    enabled: !!user,
  });
  const pendingCount = registrationsData?.counts?.pending ?? 0;

  // ── REGISTRATIONS ────────────────────────────────────────────────────────────
  const [regSearch, setRegSearch] = useState('');
  const [decideTarget, setDecideTarget] = useState<{ reg: AdminRegistration; action: 'approve' | 'reject' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const decide = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      registrationsApi.decide(id, action, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-registrations'] });
      toast.success(decideTarget?.action === 'approve' ? 'Admin approved' : 'Admin rejected');
      setDecideTarget(null);
      setRejectReason('');
    },
    onError: () => toast.error('Action failed'),
  });

  // ── USAGE ─────────────────────────────────────────────────────────────────────
  const [limitDialog, setLimitDialog] = useState(false);
  const [limitForm, setLimitForm] = useState({ agent_id: '', target_user_id: '', limit_minutes: '' });
  const [usageTab, setUsageTab] = useState<'agents' | 'admins' | 'limits'>('agents');
  const { data: usageStats, isLoading: usageLoading } = useQuery({
    queryKey: ['superadmin-usage'],
    queryFn: usageApi.adminStats,
    enabled: !!user && activeSection === 'usage',
  });
  const { data: limitsData = [], isLoading: limitsLoading } = useQuery({
    queryKey: ['usage-limits'],
    queryFn: usageApi.getLimits,
    enabled: !!user && activeSection === 'usage',
  });
  const { data: adminsForLimit = [] } = useQuery({
    queryKey: ['users-admins-limit'],
    queryFn: () => usersApi.list({ role: 'admin', page_size: 100 }),
    select: (d) => d.results ?? [],
    enabled: !!user && limitDialog,
  });
  const setLimitMutation = useMutation({
    mutationFn: usageApi.setLimit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usage-limits'] });
      setLimitDialog(false);
      setLimitForm({ agent_id: '', target_user_id: '', limit_minutes: '' });
      toast.success('Time limit set');
    },
    onError: () => toast.error('Failed to set limit'),
  });
  const deleteLimitMutation = useMutation({
    mutationFn: usageApi.deleteLimit,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usage-limits'] }); toast.success('Limit removed'); },
  });

  // ── AGENTS ────────────────────────────────────────────────────────────────────
  const [agentDialog, setAgentDialog] = useState<{ mode: 'create' | 'edit'; agent?: Agent } | null>(null);
  const [agentForm, setAgentForm] = useState<CreateAgentPayload>(BLANK_AGENT);
  const [deleteAgentSlug, setDeleteAgentSlug] = useState<string | null>(null);

  const openCreateAgent = () => { setAgentForm(BLANK_AGENT); setAgentDialog({ mode: 'create' }); };
  const openEditAgent = (a: Agent) => {
    setAgentForm({ name: a.name, subtitle: a.subtitle ?? '', description: a.description ?? '', agent_type: a.agent_type, status: a.status, latency: a.latency, efficiency: a.efficiency, is_active: a.is_active, config: a.config });
    setAgentDialog({ mode: 'edit', agent: a });
  };
  const saveAgent = useMutation({
    mutationFn: (f: CreateAgentPayload) => agentDialog?.mode === 'edit' && agentDialog.agent ? agentsApi.update(agentDialog.agent.slug, f) : agentsApi.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents-list'] }); toast.success(agentDialog?.mode === 'edit' ? 'Agent updated' : 'Agent created'); setAgentDialog(null); },
    onError: () => toast.error('Failed to save agent'),
  });
  const toggleAgent = useMutation({
    mutationFn: (slug: string) => agentsApi.toggleStatus(slug),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents-list'] }); toast.success('Agent status toggled'); },
    onError: () => toast.error('Failed to toggle agent'),
  });
  const deleteAgent = useMutation({
    mutationFn: (slug: string) => agentsApi.delete(slug),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents-list'] }); toast.success('Agent deleted'); setDeleteAgentSlug(null); },
    onError: () => toast.error('Failed to delete agent'),
  });

  // ── PROVIDERS ─────────────────────────────────────────────────────────────────
  const [providerAgentId, setProviderAgentId] = useState<string | null>(null);
  const [providerAgentName, setProviderAgentName] = useState('');
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderFormState>(BLANK_PROVIDER);
  const [presetChoice, setPresetChoice] = useState('');
  const { data: agentProviders = [], isLoading: providersLoading } = useQuery({
    queryKey: ['admin-providers', providerAgentId],
    queryFn: () => integrationsApi.listAdminProviders(providerAgentId!),
    enabled: !!providerAgentId,
  });
  const closeProviderForm = () => { setAddProviderOpen(false); setEditingProviderId(null); setProviderForm(BLANK_PROVIDER); setPresetChoice(''); };
  const buildProviderPayload = () => {
    const base = { provider: providerForm.provider, display_name: providerForm.display_name, logo_url: providerForm.logo_url || undefined, auth_type: providerForm.auth_type };
    if (providerForm.auth_type === 'oauth2') return { ...base, oauth_config: { auth_url: providerForm.oauth_config.auth_url, token_url: providerForm.oauth_config.token_url, scopes: scopesToArray(providerForm.oauth_config.scopes), client_id_setting: providerForm.oauth_config.client_id_setting, client_secret_setting: providerForm.oauth_config.client_secret_setting, ...(providerForm.oauth_config.extra_params.trim() && { extra_params: extraParamsToRecord(providerForm.oauth_config.extra_params) }) } };
    const fs = (() => { try { return providerForm.field_schema_raw.trim() ? JSON.parse(providerForm.field_schema_raw) : []; } catch { return []; } })();
    return { ...base, field_schema: fs };
  };
  const addProvider = useMutation({ mutationFn: (data: Parameters<typeof integrationsApi.createAdminProvider>[0]) => integrationsApi.createAdminProvider(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers', providerAgentId] }); toast.success('Provider added'); closeProviderForm(); }, onError: () => toast.error('Failed to add provider') });
  const updateProvider = useMutation({ mutationFn: ({ id, data }: { id: string; data: Parameters<typeof integrationsApi.updateAdminProvider>[1] }) => integrationsApi.updateAdminProvider(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers', providerAgentId] }); toast.success('Provider updated'); closeProviderForm(); }, onError: () => toast.error('Failed to update provider') });
  const deleteProvider = useMutation({ mutationFn: integrationsApi.deleteAdminProvider, onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers', providerAgentId] }); toast.success('Provider removed'); }, onError: () => toast.error('Failed to remove provider') });
  const openEditProvider = (p: IntegrationProvider) => { setEditingProviderId(p.id); setPresetChoice(''); setProviderForm({ provider: p.provider, display_name: p.display_name, logo_url: p.logo_url ?? '', auth_type: p.auth_type, oauth_config: oauthFormFromProvider(p), field_schema_raw: p.field_schema?.length ? JSON.stringify(p.field_schema, null, 2) : '' }); setAddProviderOpen(true); };
  const applyPreset = (v: string) => { setPresetChoice(v); if (v === '__custom__') { setProviderForm((f) => ({ ...f, provider: '', display_name: '', oauth_config: { ...BLANK_OAUTH } })); return; } const p = PRESETS.find((x) => x.provider === v); if (p) { const fieldSchemaRaw = p.auth_type === 'apikey' && p.field_schema ? JSON.stringify(p.field_schema, null, 2) : ''; setProviderForm((f) => ({ ...f, provider: p.provider, display_name: p.display_name, auth_type: p.auth_type, oauth_config: p.oauth_config ? { ...p.oauth_config } : { ...BLANK_OAUTH }, field_schema_raw: fieldSchemaRaw })); } };
  const oauthValid = providerForm.auth_type !== 'oauth2' || (!!providerForm.oauth_config.auth_url.trim() && !!providerForm.oauth_config.token_url.trim() && !!providerForm.oauth_config.client_id_setting.trim() && !!providerForm.oauth_config.client_secret_setting.trim());
  const providerBusy = addProvider.isPending || updateProvider.isPending;

  // ── ORGANIZATIONS ─────────────────────────────────────────────────────────────
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgActiveDialog, setOrgActiveDialog] = useState<Organization | null>(null);
  const { data: orgAgentAccess = [], isFetching: orgAgentsFetching } = useQuery({ queryKey: ['org-agents', expandedOrg], queryFn: () => organizationsApi.listOrgAgentAccess(expandedOrg!), enabled: !!expandedOrg });
  const updateOrgActive = useMutation({ mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => organizationsApi.updateById(id, { is_active }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['org', 'all'] }); toast.success('Organization updated'); setOrgActiveDialog(null); }, onError: () => toast.error('Failed to update organization') });
  const [toggleOrgAgentDialog, setToggleOrgAgentDialog] = useState<{ orgId: string; orgName: string; agentId: string; agentName: string; current: boolean } | null>(null);
  const toggleOrgAgent = useToggleOrgAgent();

  // ── USERS ─────────────────────────────────────────────────────────────────────
  const [userSearch, setUserSearch]                   = useState('');
  const [submittedUserSearch, setSubmittedUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter]           = useState('all');
  const [userStatusFilter, setUserStatusFilter]       = useState('all');
  const [userPage, setUserPage]                       = useState(1);
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users-all', userPage, submittedUserSearch, userRoleFilter, userStatusFilter],
    queryFn: () => usersApi.list({ page: userPage, page_size: 20, search: submittedUserSearch || undefined, role: userRoleFilter !== 'all' ? userRoleFilter : undefined, is_active: userStatusFilter === 'active' ? 'true' : userStatusFilter === 'inactive' ? 'false' : undefined }),
    enabled: !!user,
    placeholderData: (prev) => prev,
  });
  const userList: ApiUser[] = usersData?.results ?? [];
  const userTotal = usersData?.count ?? 0;
  const userPages = Math.ceil(userTotal / 20);
  const { data: adminsList = [] } = useQuery({ queryKey: ['users-admins'], queryFn: () => usersApi.list({ role: 'admin', page_size: 100 }), select: (d) => d.results ?? [], enabled: !!user });

  const [roleDialog,     setRoleDialog]     = useState<ApiUser | null>(null);
  const [newRole,        setNewRole]        = useState<string>('');
  const [lockDialog,     setLockDialog]     = useState<ApiUser | null>(null);
  const [lockMinutes,    setLockMinutes]    = useState('60');
  const [managerDialog,  setManagerDialog]  = useState<ApiUser | null>(null);
  const [managerId,      setManagerId]      = useState<string>('__none__');
  const [confirmDialog,  setConfirmDialog]  = useState<{ user: ApiUser; action: 'unlock' | 'activate' | 'deactivate' } | null>(null);
  const [diagnosticUser, setDiagnosticUser] = useState<ApiUser | null>(null);
  const { data: diagnostic, isFetching: diagLoading } = useQuery<AccessDiagnostic>({ queryKey: ['diagnostic', diagnosticUser?.id], queryFn: () => usersApi.accessDiagnostic(diagnosticUser!.id), enabled: !!diagnosticUser });
  const invalidateUsers = () => qc.invalidateQueries({ queryKey: ['users-all'] });
  const changeRole    = useMutation({ mutationFn: () => usersApi.updateRole(roleDialog!.id, newRole), onSuccess: () => { invalidateUsers(); toast.success('Role updated'); setRoleDialog(null); }, onError: () => toast.error('Failed to update role') });
  const lockUser      = useMutation({ mutationFn: () => usersApi.lock(lockDialog!.id, parseInt(lockMinutes, 10)), onSuccess: () => { invalidateUsers(); toast.success('User locked'); setLockDialog(null); }, onError: () => toast.error('Failed to lock user') });
  const confirmAction = useMutation({ mutationFn: () => { if (!confirmDialog) return Promise.resolve(); const { user: u, action } = confirmDialog; if (action === 'unlock') return usersApi.unlock(u.id); if (action === 'activate') return usersApi.activate(u.id); if (action === 'deactivate') return usersApi.deactivate(u.id); return Promise.resolve(); }, onSuccess: () => { invalidateUsers(); toast.success('Done'); setConfirmDialog(null); }, onError: () => toast.error('Action failed') });
  const assignManager = useMutation({ mutationFn: () => usersApi.assignManager(managerDialog!.id, managerId === '__none__' ? null : managerId), onSuccess: () => { invalidateUsers(); toast.success('Manager updated'); setManagerDialog(null); }, onError: () => toast.error('Failed to assign manager') });

  // ── Guard ─────────────────────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#020B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #FFB400', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const totalMembers = orgs.reduce((s, o) => s + o.member_count, 0);

  // ── NAV items ─────────────────────────────────────────────────────────────────
  const navItems: { id: NavSection; icon: React.ComponentType<{ size?: number; color?: string }>; label: string; badge?: number }[] = [
    { id: 'overview',       icon: LayoutDashboard, label: 'Overview' },
    { id: 'agents',         icon: Bot,             label: 'Agents' },
    { id: 'organizations',  icon: Building2,       label: 'Organizations' },
    { id: 'users',          icon: Users,           label: 'Users' },
    { id: 'registrations',  icon: UserCheck,       label: 'Registrations', badge: pendingCount },
    { id: 'usage',          icon: BarChart3,       label: 'Usage & Limits' },
  ];

  const nav = (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,180,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px 14px 4px', marginBottom: 2 }}>Main</div>
      {navItems.map(({ id, icon, label, badge }) => (
        <NavItem key={id} icon={icon} label={label} active={activeSection === id} badge={badge} onClick={() => { setActiveSection(id); setSidebarOpen(false); }} />
      ))}
    </nav>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#020B18', fontFamily: 'Inter, sans-serif', color: '#E8F4FF', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .sa-sidebar { display: none !important; } .sa-sidebar.open { display: flex !important; } .sa-hamburger { display: flex !important; } }
        @media (min-width: 769px) { .sa-hamburger { display: none !important; } .sa-overlay { display: none !important; } }
      `}</style>

      {/* ── Top bar ── */}
      <header style={{ height: 56, background: 'rgba(0,5,18,0.95)', borderBottom: '1px solid rgba(255,180,0,0.15)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, position: 'sticky' as const, top: 0, zIndex: 60 }}>
        {/* hamburger */}
        <button className="sa-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFB400', padding: 4, display: 'none' }}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,180,0,0.12)', border: '1px solid rgba(255,180,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={14} color="#FFB400" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#FFB400' }}>Superadmin</span>
          <span style={{ fontSize: 11, color: 'rgba(255,180,0,0.35)', display: 'none' }} className="sa-brand-subtitle">Life Science AI</span>
        </div>

        {/* Active section label (mobile) */}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(160,200,240,0.6)', marginLeft: 4, flex: 1 }}>
          {navItems.find(n => n.id === activeSection)?.label ?? activeSection}
        </span>

        {/* Right: email + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'rgba(160,200,240,0.4)', display: 'none' }} className="sa-email">{user.email}</span>
          <button onClick={() => logout.mutate()} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)', color: '#FF8080', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Sidebar ── */}
        <aside
          className={`sa-sidebar${sidebarOpen ? ' open' : ''}`}
          style={{ width: 220, background: 'rgba(0,8,25,0.95)', borderRight: '1px solid rgba(0,100,180,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0, position: 'sticky' as const, top: 56, height: 'calc(100vh - 56px)', zIndex: 50 }}
        >
          {/* User card */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,100,180,0.12)', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.45)', marginBottom: 2 }}>Signed in as</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(160,200,240,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{user.email}</div>
          </div>
          {nav}
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="sa-overlay" onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, top: 56 }} />
        )}

        {/* ── Main content ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px', minWidth: 0 }}>

          {/* ══ OVERVIEW ══ */}
          {activeSection === 'overview' && (
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#E8F4FF', marginBottom: 4, letterSpacing: '-0.02em' }}>Platform Overview</h1>
              <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)', marginBottom: 24 }}>High-level stats across all organizations and agents.</p>

              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
                {[
                  { label: 'Organizations', value: orgs.length,    icon: Building2,  color: '#FFB400', bg: 'rgba(255,180,0,0.08)',   border: 'rgba(255,180,0,0.2)', action: () => setActiveSection('organizations') },
                  { label: 'Agents',        value: agents.length,  icon: Bot,        color: '#00D4FF', bg: 'rgba(0,212,255,0.08)',   border: 'rgba(0,212,255,0.2)', action: () => setActiveSection('agents') },
                  { label: 'Total Members', value: totalMembers,   icon: Users,      color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', action: () => setActiveSection('users') },
                  { label: 'Pending Approvals', value: pendingCount, icon: UserCheck, color: '#FF9500', bg: 'rgba(255,149,0,0.08)',  border: 'rgba(255,149,0,0.2)', action: () => setActiveSection('registrations') },
                ].map(({ label, value, icon: Icon, color, bg, border, action }) => (
                  <button key={label} onClick={action} style={{ ...S.card, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', width: '100%', textAlign: 'left' as const, transition: 'transform 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color={color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)', marginTop: 3 }}>{label}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick nav cards */}
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'rgba(120,170,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Quick Access</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Manage Agents', desc: 'Create, edit, toggle AI agents', icon: Bot, color: '#00D4FF', section: 'agents' as NavSection },
                  { label: 'Organizations', desc: 'Activate orgs, control agent access', icon: Building2, color: '#FFB400', section: 'organizations' as NavSection },
                  { label: 'User Management', desc: 'Search users, lock, change roles', icon: Users, color: '#A78BFA', section: 'users' as NavSection },
                ].map(({ label, desc, icon: Icon, color, section }) => (
                  <button key={label} onClick={() => setActiveSection(section)}
                    style={{ ...S.card, textAlign: 'left' as const, cursor: 'pointer', transition: 'all 0.15s', display: 'block', width: '100%' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,20,55,0.9)'; (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}40`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,15,40,0.8)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,100,180,0.18)'; }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}12`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      <Icon size={15} color={color} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#E8F4FF', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.45)' }}>{desc}</div>
                  </button>
                ))}
                <button onClick={() => setActiveSection('registrations')}
                  style={{ ...S.card, textDecoration: 'none', display: 'block', transition: 'all 0.15s', cursor: 'pointer', textAlign: 'left' as const, width: '100%' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,20,55,0.9)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,15,40,0.8)'; }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative' as const }}>
                    <UserCheck size={15} color="#FF9500" />
                    {pendingCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#FFB400', fontSize: 9, fontWeight: 800, color: '#020B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingCount}</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E8F4FF', marginBottom: 3 }}>Admin Registrations</div>
                  <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.45)' }}>Approve or reject new admin accounts</div>
                </button>
              </div>

              {/* Difference callout */}
              <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: 10, background: 'rgba(0,100,180,0.06)', border: '1px solid rgba(0,100,180,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,212,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Users vs Registrations — what's the difference?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', marginBottom: 4 }}>👥 Users</div>
                    <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.6)', lineHeight: 1.5 }}>All platform accounts (admins & regular users). Search by email, lock/unlock, change roles, assign managers, and run access diagnostics.</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#FF9500', marginBottom: 4 }}>✅ Registrations</div>
                    <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.6)', lineHeight: 1.5 }}>Admins who self-registered and are waiting for your approval. Approve to activate their account, or reject with a reason.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ AGENTS ══ */}
          {activeSection === 'agents' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' as const }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 4, letterSpacing: '-0.02em' }}>AI Agents</h1>
                  <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)' }}>Create agents, define their integrations and manage global status.</p>
                </div>
                <Button onClick={openCreateAgent} className="bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 gap-2 shrink-0">
                  <Plus size={14} /> Create Agent
                </Button>
              </div>

              {agents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'rgba(120,170,220,0.3)' }}>
                  <Bot size={36} color="rgba(0,212,255,0.2)" style={{ margin: '0 auto 12px' }} />
                  <div>No agents yet.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {(agents as Agent[]).map((a) => (
                    <div key={a.id} style={{ ...S.card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={15} color="#00D4FF" /></div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.name}</div>
                            {a.subtitle && <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.subtitle}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: a.is_active ? 'rgba(0,255,136,0.08)' : 'rgba(255,80,80,0.08)', color: a.is_active ? '#00FF88' : '#FF5050', border: `1px solid ${a.is_active ? 'rgba(0,255,136,0.2)' : 'rgba(255,80,80,0.2)'}`, fontWeight: 700 }}>{a.is_active ? 'Live' : 'Off'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                        <button onClick={() => { setProviderAgentId(a.id); setProviderAgentName(a.name); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#A78BFA', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}><Settings2 size={12} /> Integrations</button>
                        <button onClick={() => openEditAgent(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(0,212,255,0.25)', background: 'rgba(0,212,255,0.06)', color: '#00D4FF', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}><Pencil size={12} /> Edit</button>
                        <button onClick={() => toggleAgent.mutate(a.slug)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${a.is_active ? 'rgba(255,80,80,0.25)' : 'rgba(0,255,136,0.25)'}`, background: a.is_active ? 'rgba(255,80,80,0.06)' : 'rgba(0,255,136,0.06)', color: a.is_active ? '#FF5050' : '#00FF88', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{a.is_active ? <PowerOff size={12} /> : <Power size={12} />}{a.is_active ? 'Disable' : 'Enable'}</button>
                        <button onClick={() => setDeleteAgentSlug(a.slug)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,80,80,0.2)', background: 'rgba(255,80,80,0.05)', color: '#FF5050', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}><Trash2 size={12} /> Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ ORGANIZATIONS ══ */}
          {activeSection === 'organizations' && (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 4, letterSpacing: '-0.02em' }}>Organizations</h1>
              <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)', marginBottom: 20 }}>Activate/deactivate orgs and control per-org agent access.</p>

              {orgsLoading ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'rgba(120,170,220,0.4)' }}>Loading…</div>
              ) : orgs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'rgba(120,170,220,0.3)' }}>No organizations yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orgs.map((org) => (
                    <div key={org.id} style={{ borderRadius: 12, background: 'rgba(0,15,40,0.8)', border: '1px solid rgba(0,100,180,0.2)', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(120,170,220,0.5)', padding: 0, flexShrink: 0 }}>
                          {expandedOrg === org.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Building2 size={15} color="#FFB400" /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{org.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{org.owner_email} · {org.member_count} members · {org.plan.display_name}</div>
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: org.is_active ? 'rgba(0,255,136,0.08)' : 'rgba(255,80,80,0.08)', color: org.is_active ? '#00FF88' : '#FF5050', border: `1px solid ${org.is_active ? 'rgba(0,255,136,0.2)' : 'rgba(255,80,80,0.2)'}`, fontWeight: 700, flexShrink: 0 }}>{org.is_active ? 'Active' : 'Inactive'}</span>
                        <button onClick={() => setOrgActiveDialog(org)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${org.is_active ? 'rgba(255,80,80,0.3)' : 'rgba(0,255,136,0.3)'}`, background: org.is_active ? 'rgba(255,80,80,0.06)' : 'rgba(0,255,136,0.06)', color: org.is_active ? '#FF5050' : '#00FF88', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                          {org.is_active ? <ShieldOff size={11} /> : <Shield size={11} />}{org.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                      {expandedOrg === org.id && (
                        <div style={{ borderTop: '1px solid rgba(0,100,180,0.12)', padding: '12px 18px', background: 'rgba(0,10,28,0.5)' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(120,170,220,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Agent Kill Switches</div>
                          {orgAgentsFetching ? (
                            <div style={{ fontSize: 13, color: 'rgba(120,170,220,0.4)' }}><RefreshCw size={13} style={{ display: 'inline', marginRight: 6 }} />Loading…</div>
                          ) : orgAgentAccess.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'rgba(120,170,220,0.35)' }}>No agents assigned to this org yet.</p>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                              {(orgAgentAccess as OrgAgentAccess[]).map((item) => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, background: 'rgba(0,20,50,0.7)', border: '1px solid rgba(0,100,180,0.15)' }}>
                                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{item.agent_name}</div>{item.disabled_by_email && <div style={{ fontSize: 10, color: 'rgba(255,80,80,0.6)' }}>Off by {item.disabled_by_email}</div>}</div>
                                  <button onClick={() => setToggleOrgAgentDialog({ orgId: org.id, orgName: org.name, agentId: item.agent, agentName: item.agent_name, current: item.is_enabled })} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: `1px solid ${item.is_enabled ? 'rgba(0,255,136,0.25)' : 'rgba(255,80,80,0.25)'}`, background: item.is_enabled ? 'rgba(0,255,136,0.07)' : 'rgba(255,80,80,0.07)', color: item.is_enabled ? '#00FF88' : '#FF5050', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{item.is_enabled ? <Power size={10} /> : <PowerOff size={10} />}{item.is_enabled ? 'On' : 'Off'}</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ USERS ══ */}
          {activeSection === 'users' && (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 4, letterSpacing: '-0.02em' }}>User Management</h1>
              <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)', marginBottom: 16 }}>
                Manage platform accounts. Lock/unlock, change roles, assign managers, or run an access diagnostic. Use search to filter by email.
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,149,0,0.1)', color: '#FF9500', fontSize: 11, fontWeight: 600, border: '1px solid rgba(255,149,0,0.25)', verticalAlign: 'middle' }}>
                  <UserCheck size={11} /> Admin approvals → <button onClick={() => setActiveSection('registrations')} style={{ color: '#FF9500', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>Registrations</button>
                </span>
              </p>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
                <div style={{ position: 'relative' as const, flex: '1 1 280px', display: 'flex', gap: 6 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(120,170,220,0.4)', pointerEvents: 'none' }} />
                    <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSubmittedUserSearch(userSearch); setUserPage(1); } }} placeholder="Search by email…"
                      style={{ ...S.card, padding: '9px 12px 9px 30px', fontSize: 13, width: '100%', color: '#E8F4FF', outline: 'none', background: 'rgba(0,15,40,0.7)' }} />
                  </div>
                  <button onClick={() => { setSubmittedUserSearch(userSearch); setUserPage(1); }} style={S.btn}>Search</button>
                </div>
                <select value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }} style={{ ...S.card, padding: '9px 14px', fontSize: 12, cursor: 'pointer', background: 'rgba(0,15,40,0.7)', color: '#E8F4FF', outline: 'none', minWidth: 120 }}>
                  <option value="all">All roles</option>
                  <option value="superadmin">Superadmin</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
                <select value={userStatusFilter} onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }} style={{ ...S.card, padding: '9px 14px', fontSize: 12, cursor: 'pointer', background: 'rgba(0,15,40,0.7)', color: '#E8F4FF', outline: 'none', minWidth: 120 }}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {userTotal > 0 && <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.4)', alignSelf: 'center', marginLeft: 'auto' }}>{userTotal} users</div>}
              </div>

              {/* Table */}
              <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,10,30,0.6)' }}>
                        <th style={S.th}>User</th>
                        <th style={S.th}>Role</th>
                        <th style={S.th}>Status</th>
                        <th style={S.th}>Last Login</th>
                        <th style={S.th}>Manager</th>
                        <th style={{ ...S.th, textAlign: 'right' as const }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersLoading ? (
                        <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: 'rgba(120,170,220,0.4)', padding: 40 }}>Loading…</td></tr>
                      ) : userList.length === 0 ? (
                        <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: 'rgba(120,170,220,0.3)', padding: 40 }}>No users found</td></tr>
                      ) : userList.map((u) => {
                        const isLocked = !!u.is_locked;
                        return (
                          <tr key={u.id} style={{ transition: 'background 0.1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,100,180,0.04)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={S.td}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{u.email}</div>
                              <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.4)' }}>joined {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}</div>
                            </td>
                            <td style={S.td}>{roleBadge(u.role)}</td>
                            <td style={S.td}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {isLocked ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,180,0,0.1)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.25)', fontWeight: 700 }}>Locked</span>
                                  : u.is_active ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)', fontWeight: 700 }}>Active</span>
                                  : <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,80,80,0.08)', color: '#FF5050', border: '1px solid rgba(255,80,80,0.2)', fontWeight: 700 }}>Inactive</span>}
                                {!u.is_verified && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(120,120,120,0.1)', color: 'rgba(120,170,220,0.5)', border: '1px solid rgba(120,120,120,0.2)', fontWeight: 700 }}>Unverified</span>}
                              </div>
                            </td>
                            <td style={{ ...S.td, fontSize: 12, color: 'rgba(120,170,220,0.6)' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}</td>
                            <td style={{ ...S.td, fontSize: 12, color: 'rgba(120,170,220,0.55)' }}>{u.managed_by?.email ?? '—'}</td>
                            <td style={{ ...S.td, textAlign: 'right' as const }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button title="Change role" onClick={() => { setRoleDialog(u); setNewRole(u.role); }} style={{ padding: '5px', borderRadius: 6, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#A78BFA', cursor: 'pointer' }}><UserCog size={13} /></button>
                                {isLocked ? <button title="Unlock" onClick={() => setConfirmDialog({ user: u, action: 'unlock' })} style={{ padding: '5px', borderRadius: 6, background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)', color: '#FFB400', cursor: 'pointer' }}><Unlock size={13} /></button>
                                  : <button title="Lock user" onClick={() => { setLockDialog(u); setLockMinutes('60'); }} style={{ padding: '5px', borderRadius: 6, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF7070', cursor: 'pointer' }}><Lock size={13} /></button>}
                                {u.is_active ? <button title="Deactivate" onClick={() => setConfirmDialog({ user: u, action: 'deactivate' })} style={{ padding: '5px', borderRadius: 6, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF5050', cursor: 'pointer' }}><PowerOff size={13} /></button>
                                  : <button title="Activate" onClick={() => setConfirmDialog({ user: u, action: 'activate' })} style={{ padding: '5px', borderRadius: 6, background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.2)', color: '#00FF88', cursor: 'pointer' }}><Power size={13} /></button>}
                                <button title="Assign manager" onClick={() => { setManagerDialog(u); setManagerId(u.managed_by?.id ?? '__none__'); }} style={{ padding: '5px', borderRadius: 6, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00D4FF', cursor: 'pointer' }}><Users size={13} /></button>
                                <button title="Access diagnostic" onClick={() => setDiagnosticUser(u)} style={{ padding: '5px', borderRadius: 6, background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)', color: '#FFB400', cursor: 'pointer' }}><BarChart2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {userPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid rgba(0,100,180,0.12)' }}>
                    <button disabled={userPage === 1} onClick={() => setUserPage((p) => p - 1)} style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(0,100,180,0.15)', border: '1px solid rgba(0,100,180,0.2)', color: '#E8F4FF', fontSize: 12, cursor: userPage === 1 ? 'not-allowed' : 'pointer', opacity: userPage === 1 ? 0.4 : 1 }}>← Prev</button>
                    <span style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)', alignSelf: 'center' }}>Page {userPage} of {userPages}</span>
                    <button disabled={userPage === userPages} onClick={() => setUserPage((p) => p + 1)} style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(0,100,180,0.15)', border: '1px solid rgba(0,100,180,0.2)', color: '#E8F4FF', fontSize: 12, cursor: userPage === userPages ? 'not-allowed' : 'pointer', opacity: userPage === userPages ? 0.4 : 1 }}>Next →</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ REGISTRATIONS ══ */}
          {activeSection === 'registrations' && (() => {
            const regCounts = registrationsData?.counts ?? {};
            const regPending  = (registrationsData?.pending  ?? []).filter(r => r.email.toLowerCase().includes(regSearch.toLowerCase()));
            const regApproved = (registrationsData?.approved ?? []).filter(r => r.email.toLowerCase().includes(regSearch.toLowerCase()));
            const regRejected = (registrationsData?.rejected ?? []).filter(r => r.email.toLowerCase().includes(regSearch.toLowerCase()));
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' as const }}>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 4, letterSpacing: '-0.02em' }}>Admin Registrations</h1>
                    <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)' }}>Review and approve admin account requests for your platform.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ position: 'relative' as const }}>
                      <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(120,170,220,0.4)', pointerEvents: 'none' as const }} />
                      <input placeholder="Search by email…" value={regSearch} onChange={e => setRegSearch(e.target.value)}
                        style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'rgba(0,20,50,0.8)', border: '1px solid rgba(0,100,180,0.3)', borderRadius: 9, fontSize: 13, color: '#E8F4FF', outline: 'none', width: 220 }} />
                    </div>
                  </div>
                </div>

                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
                  {[
                    { label: 'Pending Review',  value: regCounts.pending  ?? 0, color: '#FFB400', bg: 'rgba(255,180,0,0.08)',   border: 'rgba(255,180,0,0.2)',   icon: Clock },
                    { label: 'Approved Admins', value: regCounts.approved ?? 0, color: '#00CC66', bg: 'rgba(0,200,100,0.08)',   border: 'rgba(0,200,100,0.2)',   icon: CheckCircle2 },
                    { label: 'Rejected',        value: regCounts.rejected ?? 0, color: '#FF6060', bg: 'rgba(255,60,60,0.08)',   border: 'rgba(255,60,60,0.2)',   icon: XCircle },
                  ].map(({ label, value, color, bg, border, icon: Icon }) => (
                    <div key={label} style={{ borderRadius: 12, background: bg, border: `1px solid ${border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color={color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)', marginTop: 3 }}>{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <Tabs defaultValue="pending">
                  <TabsList style={{ background: 'rgba(0,15,40,0.6)', border: '1px solid rgba(0,100,180,0.2)', borderRadius: 10, padding: 4, marginBottom: 16 }}>
                    <TabsTrigger value="pending" style={{ borderRadius: 7, fontSize: 13 }}>
                      Pending {regPending.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(255,180,0,0.15)', color: '#FFB400', fontWeight: 700 }}>{regPending.length}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="approved" style={{ borderRadius: 7, fontSize: 13 }}>Approved ({regApproved.length})</TabsTrigger>
                    <TabsTrigger value="rejected" style={{ borderRadius: 7, fontSize: 13 }}>Rejected ({regRejected.length})</TabsTrigger>
                  </TabsList>

                  {(['pending', 'approved', 'rejected'] as const).map(tab => {
                    const rows = tab === 'pending' ? regPending : tab === 'approved' ? regApproved : regRejected;
                    return (
                      <TabsContent key={tab} value={tab}>
                        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                          {rows.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0' }}>
                              <div style={{ fontSize: 36, marginBottom: 12 }}>{tab === 'pending' ? '🎉' : tab === 'approved' ? '📋' : '📭'}</div>
                              <div style={{ color: 'rgba(120,170,220,0.5)', fontSize: 14 }}>
                                {tab === 'pending' ? 'No pending registrations' : tab === 'approved' ? 'No approved admins yet' : 'No rejected registrations'}
                              </div>
                            </div>
                          ) : (
                            <div style={{ overflowX: 'auto' as const }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                                <thead>
                                  <tr style={{ background: 'rgba(0,10,30,0.6)' }}>
                                    <th style={{ ...S.th, textAlign: 'left' as const }}>Email / Name</th>
                                    <th style={{ ...S.th, textAlign: 'left' as const }}>Status</th>
                                    <th style={{ ...S.th, textAlign: 'left' as const }}>Members</th>
                                    <th style={{ ...S.th, textAlign: 'left' as const }}>Registered</th>
                                    <th style={{ ...S.th, textAlign: 'right' as const }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map(reg => (
                                    <AdminRegRow key={reg.id} reg={reg} onDecide={(r, a) => { setDecideTarget({ reg: r, action: a }); setRejectReason(''); }} />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {tab === 'rejected' && rows.some(r => r.rejection_reason) && (
                            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,60,60,0.1)', background: 'rgba(255,60,60,0.03)' }}>
                              {rows.filter(r => r.rejection_reason).map(r => (
                                <div key={r.id} style={{ fontSize: 12, color: 'rgba(255,130,130,0.7)', marginBottom: 4 }}>
                                  <span style={{ fontWeight: 600, color: 'rgba(255,130,130,0.9)' }}>{r.email}:</span> {r.rejection_reason}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            );
          })()}

          {/* ══ USAGE & LIMITS ══ */}
          {activeSection === 'usage' && (() => {
            const byAgent = usageStats?.by_agent ?? [];
            const byUser  = usageStats?.by_user  ?? [];
            const totalMinutes = byAgent.reduce((s: number, a: { total_minutes: number }) => s + a.total_minutes, 0);
            const limits = limitsData as TimeLimit[];
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' as const }}>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 4, letterSpacing: '-0.02em' }}>Usage & Limits</h1>
                    <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)' }}>Monitor agent usage across all admins and set time restrictions.</p>
                  </div>
                  <button onClick={() => setLimitDialog(true)} style={{ ...S.btn, padding: '8px 16px', fontSize: 13 }}>
                    <Plus size={14} /> Set Time Limit
                  </button>
                </div>

                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
                  {[
                    { label: 'Total Platform Minutes', value: usageLoading ? '—' : `${totalMinutes} min`, sub: `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`, color: '#00D4FF', bg: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.2)', icon: TrendingUp },
                    { label: 'Active Agents',          value: usageLoading ? '—' : String(byAgent.length), sub: 'agents with usage',   color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', icon: Bot },
                    { label: 'Time Limits Set',        value: limitsLoading ? '—' : String(limits.length), sub: 'admin restrictions',  color: '#FFB400', bg: 'rgba(255,180,0,0.08)',   border: 'rgba(255,180,0,0.2)',   icon: Timer },
                  ].map(({ label, value, sub, color, bg, border, icon: Icon }) => (
                    <div key={label} style={{ borderRadius: 12, background: bg, border: `1px solid ${border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color={color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>{label}</div>
                        <div style={{ fontSize: 10, color: 'rgba(120,170,220,0.35)', marginTop: 1 }}>{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(0,15,40,0.6)', border: '1px solid rgba(0,100,180,0.2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
                  {([['agents', 'By Agent'], ['admins', 'By Admin'], ['limits', 'Time Limits']] as const).map(([tab, lbl]) => (
                    <button key={tab} onClick={() => setUsageTab(tab)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: usageTab === tab ? 700 : 500, background: usageTab === tab ? 'rgba(0,212,255,0.15)' : 'transparent', color: usageTab === tab ? '#00D4FF' : 'rgba(120,170,220,0.6)', transition: 'all 0.15s' }}>{lbl}</button>
                  ))}
                </div>

                {/* By Agent */}
                {usageTab === 'agents' && (
                  <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,100,180,0.12)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#E8F4FF' }}>Agent Usage — Platform Total</div>
                      <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>Total minutes all admins and their users spent on each agent</div>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      {usageLoading ? (
                        <div style={{ textAlign: 'center', padding: 32, color: 'rgba(120,170,220,0.4)' }}>Loading…</div>
                      ) : byAgent.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(120,170,220,0.3)' }}><Bot size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />No agent usage recorded yet</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {byAgent.map((a: { agent_id: string; agent_name: string; total_minutes: number }) => {
                            const pct = totalMinutes > 0 ? Math.round((a.total_minutes / totalMinutes) * 100) : 0;
                            return (
                              <div key={a.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, background: 'rgba(0,20,50,0.6)', border: '1px solid rgba(0,100,180,0.15)' }}>
                                <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={16} color="#00D4FF" /></div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{a.agent_name}</span>
                                    <span style={{ fontWeight: 800, color: '#00D4FF', fontSize: 13 }}>{a.total_minutes} min</span>
                                  </div>
                                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,100,180,0.2)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 2, background: '#00D4FF', width: `${pct}%`, transition: 'width 0.5s' }} />
                                  </div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)', flexShrink: 0 }}>{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* By Admin */}
                {usageTab === 'admins' && (
                  <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,100,180,0.12)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#E8F4FF' }}>Admin Usage Breakdown</div>
                      <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>How much each admin&apos;s users are using each agent</div>
                    </div>
                    {usageLoading ? (
                      <div style={{ textAlign: 'center', padding: 32, color: 'rgba(120,170,220,0.4)' }}>Loading…</div>
                    ) : byUser.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, color: 'rgba(120,170,220,0.3)' }}><Users size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />No admin activity recorded yet</div>
                    ) : (
                      <div style={{ overflowX: 'auto' as const }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                          <thead><tr style={{ background: 'rgba(0,10,30,0.6)' }}>
                            <th style={{ ...S.th, textAlign: 'left' as const }}>Admin</th>
                            <th style={{ ...S.th, textAlign: 'left' as const }}>Agent</th>
                            <th style={{ ...S.th, textAlign: 'right' as const }}>Minutes Used</th>
                            <th style={{ ...S.th, textAlign: 'right' as const }}>Limit</th>
                          </tr></thead>
                          <tbody>
                            {byUser.flatMap((u: { user_id: string; user_email: string; agents: { agent_id: string; agent_name: string; minutes_used: number; limit_minutes?: number | null }[] }) =>
                              u.agents.map((a, i) => (
                                <tr key={`${u.user_id}-${a.agent_id}`} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,100,180,0.04)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  {i === 0 && (
                                    <td style={{ ...S.td, verticalAlign: 'top' as const }} rowSpan={u.agents.length}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#A78BFA' }}>{u.user_email[0].toUpperCase()}</div>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{u.user_email}</span>
                                      </div>
                                    </td>
                                  )}
                                  <td style={{ ...S.td, color: 'rgba(120,170,220,0.7)' }}>{a.agent_name}</td>
                                  <td style={{ ...S.td, textAlign: 'right' as const, fontWeight: 700, color: '#00D4FF' }}>{a.minutes_used} min</td>
                                  <td style={{ ...S.td, textAlign: 'right' as const }}>
                                    {a.limit_minutes
                                      ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: a.minutes_used >= a.limit_minutes ? 'rgba(255,60,60,0.15)' : 'rgba(120,120,120,0.15)', color: a.minutes_used >= a.limit_minutes ? '#FF6060' : 'rgba(120,170,220,0.6)', border: `1px solid ${a.minutes_used >= a.limit_minutes ? 'rgba(255,60,60,0.3)' : 'rgba(120,120,120,0.2)'}`, fontWeight: 700 }}>{a.limit_minutes} min</span>
                                      : <span style={{ color: 'rgba(120,170,220,0.3)', fontSize: 12 }}>—</span>
                                    }
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Time Limits */}
                {usageTab === 'limits' && (
                  <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,100,180,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#E8F4FF' }}>Admin Time Limits</div>
                        <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>Restrict how many minutes an admin can use each agent</div>
                      </div>
                      <button onClick={() => setLimitDialog(true)} style={{ ...S.btn }}>
                        <Plus size={13} /> Set Limit
                      </button>
                    </div>
                    {limitsLoading ? (
                      <div style={{ textAlign: 'center', padding: 32, color: 'rgba(120,170,220,0.4)' }}>Loading…</div>
                    ) : limits.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, color: 'rgba(120,170,220,0.3)' }}><Timer size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />No time limits set yet</div>
                    ) : (
                      <div style={{ overflowX: 'auto' as const }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                          <thead><tr style={{ background: 'rgba(0,10,30,0.6)' }}>
                            <th style={{ ...S.th, textAlign: 'left' as const }}>Admin</th>
                            <th style={{ ...S.th, textAlign: 'left' as const }}>Agent</th>
                            <th style={{ ...S.th, textAlign: 'right' as const }}>Limit</th>
                            <th style={{ ...S.th, textAlign: 'right' as const }}></th>
                          </tr></thead>
                          <tbody>
                            {limits.map(lim => (
                              <tr key={lim.id} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,100,180,0.04)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <td style={S.td}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#A78BFA' }}>{lim.target_user_email[0].toUpperCase()}</div>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{lim.target_user_email}</span>
                                  </div>
                                </td>
                                <td style={{ ...S.td, color: 'rgba(120,170,220,0.7)' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Bot size={12} color="rgba(120,170,220,0.5)" /> {lim.agent_name}</span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'right' as const }}>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'rgba(255,180,0,0.1)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.3)', fontWeight: 700 }}>{lim.limit_minutes} min</span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'right' as const }}>
                                  <button onClick={() => deleteLimitMutation.mutate(lim.id)} style={{ padding: 5, borderRadius: 6, background: 'rgba(255,60,60,0.07)', border: '1px solid rgba(255,60,60,0.2)', color: '#FF6060', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

        </main>
      </div>

      {/* ════════════════════════ DIALOGS (unchanged) ════════════════════════ */}

      <Dialog open={!!agentDialog} onOpenChange={(o) => !o && setAgentDialog(null)}>
        <DialogContent className="sm:max-w-125 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle>{agentDialog?.mode === 'edit' ? 'Edit Agent' : 'Create Agent'}</DialogTitle><DialogDescription>Configure the agent&apos;s details and deployment settings.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><label style={S.label}>Name *</label><Input value={agentForm.name} onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))} placeholder="Project Tracking Agent" className="bg-muted/40 border-border/40" /></div>
              <div><label style={S.label}>Subtitle</label><Input value={agentForm.subtitle ?? ''} onChange={(e) => setAgentForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Short tagline" className="bg-muted/40 border-border/40" /></div>
            </div>
            <div><label style={S.label}>Description</label><Input value={agentForm.description ?? ''} onChange={(e) => setAgentForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this agent does" className="bg-muted/40 border-border/40" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label style={S.label}>Type</label><Select value={agentForm.agent_type} onValueChange={(v) => setAgentForm((f) => ({ ...f, agent_type: v as Agent['agent_type'] }))}><SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0A1428] border-border/40 text-foreground">{['chatbot','assistant','analyzer','automation','custom'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div><label style={S.label}>Status</label><Select value={agentForm.status ?? 'live'} onValueChange={(v) => setAgentForm((f) => ({ ...f, status: v as Agent['status'] }))}><SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0A1428] border-border/40 text-foreground">{['live','offline','maintenance'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><label style={S.label}>Latency</label><Select value={agentForm.latency ?? 'fast'} onValueChange={(v) => setAgentForm((f) => ({ ...f, latency: v as Agent['latency'] }))}><SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0A1428] border-border/40 text-foreground">{['instant','fast','moderate','slow'].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><label style={S.label}>Efficiency (0-100)</label><Input type="number" min={0} max={100} value={agentForm.efficiency ?? 90} onChange={(e) => setAgentForm((f) => ({ ...f, efficiency: parseInt(e.target.value, 10) }))} className="bg-muted/40 border-border/40" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setAgentDialog(null)}>Cancel</Button><Button className="bg-sky-500 hover:bg-sky-600 text-black font-bold" disabled={!agentForm.name.trim() || saveAgent.isPending} onClick={() => saveAgent.mutate(agentForm)}>{saveAgent.isPending ? 'Saving…' : agentDialog?.mode === 'edit' ? 'Save Changes' : 'Create Agent'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteAgentSlug} onOpenChange={(o) => !o && setDeleteAgentSlug(null)}>
        <DialogContent className="sm:max-w-100 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle className="text-rose-400">Delete Agent</DialogTitle><DialogDescription>This is permanent. All access grants for this agent will also be removed.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setDeleteAgentSlug(null)}>Cancel</Button><Button variant="destructive" disabled={deleteAgent.isPending} onClick={() => deleteAgent.mutate(deleteAgentSlug!)}>{deleteAgent.isPending ? 'Deleting…' : 'Delete Agent'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!providerAgentId} onOpenChange={(o) => { if (!o) { setProviderAgentId(null); setAddProviderOpen(false); } }}>
        <DialogContent className="sm:max-w-145 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plug className="h-4 w-4 text-violet-400" /> Integrations — {providerAgentName}</DialogTitle><DialogDescription>Define which tools admins can connect for this agent.</DialogDescription></DialogHeader>
          <div className="space-y-2 max-h-52 overflow-y-auto py-1">
            {providersLoading ? <div className="text-sm text-muted-foreground text-center py-4">Loading…</div>
              : agentProviders.length === 0 ? <div className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2"><Plug className="h-8 w-8 opacity-20" />No integrations defined yet.</div>
              : agentProviders.map((p: IntegrationProvider) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/20 border border-border/30 px-4 py-2.5">
                  <div className="flex items-center gap-3">{p.logo_url ? <img src={p.logo_url} alt="" className="w-6 h-6 rounded object-contain" /> : <div className="w-6 h-6 rounded bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">{p.auth_type === 'oauth2' ? <Key className="h-3 w-3 text-violet-400" /> : <Plug className="h-3 w-3 text-violet-400" />}</div>}<span className="text-sm font-semibold">{p.display_name}</span><span className="text-[10px] font-mono text-muted-foreground">{p.provider}</span></div>
                  <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/5">{p.auth_type === 'oauth2' ? 'OAuth 2.0' : 'API Key'}</Badge><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-sky-400 hover:bg-sky-500/10" onClick={() => openEditProvider(p)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-500/10" disabled={deleteProvider.isPending} onClick={() => deleteProvider.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
                </div>
              ))}
          </div>
          {addProviderOpen ? (
            <div className="border border-border/40 rounded-xl p-4 space-y-3 bg-muted/10 max-h-96 overflow-y-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{editingProviderId ? 'Edit Integration' : 'Add Integration'}</p>
              {!editingProviderId && (<div><label style={S.label}>Quick-pick preset</label><Select value={presetChoice} onValueChange={applyPreset}><SelectTrigger className="bg-muted/40 border-border/40"><SelectValue placeholder="Choose a preset…" /></SelectTrigger><SelectContent className="bg-[#0A1428] border-border/40 text-foreground">{PRESETS.map((p) => <SelectItem key={p.provider} value={p.provider}>{p.display_name}</SelectItem>)}<SelectItem value="__custom__">Custom…</SelectItem></SelectContent></Select></div>)}
              <div className="grid grid-cols-2 gap-3"><div><label style={S.label}>Provider slug *</label><Input value={providerForm.provider} onChange={(e) => setProviderForm((f) => ({ ...f, provider: e.target.value }))} placeholder="jira" disabled={!!editingProviderId} className="bg-muted/40 border-border/40 disabled:opacity-50" /></div><div><label style={S.label}>Display name *</label><Input value={providerForm.display_name} onChange={(e) => setProviderForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Jira" className="bg-muted/40 border-border/40" /></div></div>
              <div><label style={S.label}>Logo URL</label><Input value={providerForm.logo_url} onChange={(e) => setProviderForm((f) => ({ ...f, logo_url: e.target.value }))} placeholder="https://cdn.example.com/jira.png" className="bg-muted/40 border-border/40 text-xs" /></div>
              <div><label style={S.label}>Auth type</label><Select value={providerForm.auth_type} onValueChange={(v) => setProviderForm((f) => ({ ...f, auth_type: v as 'oauth2' | 'apikey' }))}><SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0A1428] border-border/40 text-foreground"><SelectItem value="oauth2">OAuth 2.0</SelectItem><SelectItem value="apikey">API Key</SelectItem></SelectContent></Select></div>
              {providerForm.auth_type === 'oauth2' && (<div className="space-y-3 pt-1 border-t border-border/30"><p className="text-[11px] font-bold uppercase tracking-wider text-violet-400/70 pt-1">OAuth 2.0 Config</p><div><label style={S.label}>Authorization URL *</label><Input value={providerForm.oauth_config.auth_url} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, auth_url: e.target.value } }))} className="bg-muted/40 border-border/40 font-mono text-xs" /></div><div><label style={S.label}>Token URL *</label><Input value={providerForm.oauth_config.token_url} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, token_url: e.target.value } }))} className="bg-muted/40 border-border/40 font-mono text-xs" /></div><div><label style={S.label}>Scopes</label><Input value={providerForm.oauth_config.scopes} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, scopes: e.target.value } }))} className="bg-muted/40 border-border/40" /></div><div className="grid grid-cols-2 gap-3"><div><label style={S.label}>Client ID env var *</label><Input value={providerForm.oauth_config.client_id_setting} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, client_id_setting: e.target.value } }))} className="bg-muted/40 border-border/40 font-mono text-xs" /></div><div><label style={S.label}>Client secret env var *</label><Input value={providerForm.oauth_config.client_secret_setting} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, client_secret_setting: e.target.value } }))} className="bg-muted/40 border-border/40 font-mono text-xs" /></div></div><div><label style={S.label}>Extra params (key=value per line)</label><textarea value={providerForm.oauth_config.extra_params} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, extra_params: e.target.value } }))} rows={3} className="w-full rounded-md bg-muted/40 border border-border/40 text-foreground text-xs font-mono px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50" /></div></div>)}
              {providerForm.auth_type === 'apikey' && (<div className="pt-1 border-t border-border/30"><label style={S.label}>Field schema (JSON array)</label><textarea value={providerForm.field_schema_raw} onChange={(e) => setProviderForm((f) => ({ ...f, field_schema_raw: e.target.value }))} rows={4} className="w-full rounded-md bg-muted/40 border border-border/40 text-foreground text-xs font-mono px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50" /></div>)}
              <div className="flex justify-end gap-2 pt-1"><Button variant="ghost" size="sm" onClick={closeProviderForm}>Cancel</Button><Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white font-bold" disabled={!providerForm.provider.trim() || !providerForm.display_name.trim() || !oauthValid || providerBusy} onClick={() => { const payload = buildProviderPayload(); if (editingProviderId) { const { provider: _p, ...rest } = payload; updateProvider.mutate({ id: editingProviderId, data: rest }); } else { addProvider.mutate({ agent: providerAgentId!, ...payload }); } }}>{providerBusy ? (editingProviderId ? 'Saving…' : 'Adding…') : (editingProviderId ? 'Save Changes' : 'Add Provider')}</Button></div>
            </div>
          ) : (
            <Button variant="outline" className="w-full border-dashed border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/20" onClick={() => setAddProviderOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Integration Provider</Button>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => { setProviderAgentId(null); setAddProviderOpen(false); }}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orgActiveDialog} onOpenChange={(o) => !o && setOrgActiveDialog(null)}>
        <DialogContent className="sm:max-w-105 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle>{orgActiveDialog?.is_active ? 'Deactivate' : 'Activate'} Organization</DialogTitle><DialogDescription>{orgActiveDialog?.is_active ? `Deactivating "${orgActiveDialog?.name}" will block all their admins and users immediately.` : `Re-activating "${orgActiveDialog?.name}" will restore their access.`}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setOrgActiveDialog(null)}>Cancel</Button><Button className={orgActiveDialog?.is_active ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'} disabled={updateOrgActive.isPending} onClick={() => orgActiveDialog && updateOrgActive.mutate({ id: orgActiveDialog.id, is_active: !orgActiveDialog.is_active })}>{updateOrgActive.isPending ? 'Saving…' : orgActiveDialog?.is_active ? 'Deactivate Org' : 'Activate Org'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toggleOrgAgentDialog} onOpenChange={(o) => !o && setToggleOrgAgentDialog(null)}>
        <DialogContent className="sm:max-w-105 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle>{toggleOrgAgentDialog?.current ? 'Disable' : 'Enable'} Agent for Org</DialogTitle><DialogDescription>{toggleOrgAgentDialog?.current ? 'Disable' : 'Enable'} <span className="text-primary font-mono">{toggleOrgAgentDialog?.agentName}</span> for <span className="text-yellow-400">{toggleOrgAgentDialog?.orgName}</span>?</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setToggleOrgAgentDialog(null)}>Cancel</Button><Button className={toggleOrgAgentDialog?.current ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'} disabled={toggleOrgAgent.isPending} onClick={() => { if (!toggleOrgAgentDialog) return; toggleOrgAgent.mutate({ orgId: toggleOrgAgentDialog.orgId, agentId: toggleOrgAgentDialog.agentId, data: { is_enabled: !toggleOrgAgentDialog.current } }, { onSuccess: () => { setToggleOrgAgentDialog(null); qc.invalidateQueries({ queryKey: ['org-agents', toggleOrgAgentDialog.orgId] }); } }); }}>{toggleOrgAgent.isPending ? 'Saving…' : toggleOrgAgentDialog?.current ? 'Disable Agent' : 'Enable Agent'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleDialog} onOpenChange={(o) => !o && setRoleDialog(null)}>
        <DialogContent className="sm:max-w-95 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle>Change Role</DialogTitle><DialogDescription>{roleDialog?.email}</DialogDescription></DialogHeader>
          <div className="py-2"><label style={S.label}>New role</label><Select value={newRole} onValueChange={setNewRole}><SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0A1428] border-border/40 text-foreground"><SelectItem value="superadmin">Superadmin</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="user">User</SelectItem></SelectContent></Select></div>
          <DialogFooter><Button variant="ghost" onClick={() => setRoleDialog(null)}>Cancel</Button><Button className="bg-violet-600 hover:bg-violet-700 text-white font-bold" disabled={changeRole.isPending || newRole === roleDialog?.role} onClick={() => changeRole.mutate()}>{changeRole.isPending ? 'Saving…' : 'Update Role'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lockDialog} onOpenChange={(o) => !o && setLockDialog(null)}>
        <DialogContent className="sm:max-w-95 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle className="text-amber-400">Lock User</DialogTitle><DialogDescription>{lockDialog?.email}</DialogDescription></DialogHeader>
          <div className="py-2"><label style={S.label}>Lockout duration (minutes)</label><Input type="number" min={1} value={lockMinutes} onChange={(e) => setLockMinutes(e.target.value)} className="bg-muted/40 border-border/40" /></div>
          <DialogFooter><Button variant="ghost" onClick={() => setLockDialog(null)}>Cancel</Button><Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold" disabled={lockUser.isPending || !lockMinutes} onClick={() => lockUser.mutate()}>{lockUser.isPending ? 'Locking…' : 'Lock User'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDialog} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-95 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle className="capitalize">{confirmDialog?.action} User</DialogTitle><DialogDescription>{confirmDialog?.user.email}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setConfirmDialog(null)}>Cancel</Button><Button className={confirmDialog?.action === 'deactivate' ? 'bg-rose-500 hover:bg-rose-600 text-white' : confirmDialog?.action === 'activate' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-black'} disabled={confirmAction.isPending} onClick={() => confirmAction.mutate()}>{confirmAction.isPending ? 'Working…' : `Confirm ${confirmDialog?.action}`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!managerDialog} onOpenChange={(o) => !o && setManagerDialog(null)}>
        <DialogContent className="sm:max-w-100 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle>Assign Manager</DialogTitle><DialogDescription>{managerDialog?.email}</DialogDescription></DialogHeader>
          <div className="py-2"><label style={S.label}>Admin manager</label><Select value={managerId} onValueChange={setManagerId}><SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0A1428] border-border/40 text-foreground"><SelectItem value="__none__">— No manager —</SelectItem>{(adminsList as ApiUser[]).map((a) => <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>)}</SelectContent></Select></div>
          <DialogFooter><Button variant="ghost" onClick={() => setManagerDialog(null)}>Cancel</Button><Button className="bg-sky-500 hover:bg-sky-600 text-black font-bold" disabled={assignManager.isPending} onClick={() => assignManager.mutate()}>{assignManager.isPending ? 'Saving…' : 'Assign'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!diagnosticUser} onOpenChange={(o) => !o && setDiagnosticUser(null)}>
        <DialogContent className="sm:max-w-145 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BarChart2 className="h-4 w-4 text-amber-400" /> Access Diagnostic</DialogTitle><DialogDescription>{diagnosticUser?.email}</DialogDescription></DialogHeader>
          {diagLoading ? <div className="py-10 text-center text-sm text-muted-foreground">Loading diagnostic…</div>
            : diagnostic ? (
              <div className="space-y-4 max-h-105 overflow-y-auto py-1">
                <div className="grid grid-cols-4 gap-2">{[{ label: 'Total', value: diagnostic.summary.total_agents, color: '#00D4FF' }, { label: 'Accessible', value: diagnostic.summary.accessible, color: '#00FF88' }, { label: 'Blocked', value: diagnostic.summary.blocked, color: '#FF5050' }, { label: 'No Access', value: diagnostic.summary.no_access_granted, color: '#888' }].map(({ label, value, color }) => (<div key={label} className="rounded-lg bg-muted/20 border border-border/30 p-3 text-center"><div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div><div style={{ fontSize: 10, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>{label}</div></div>))}</div>
                <div className="rounded-lg bg-muted/20 border border-border/30 px-4 py-3 text-xs space-y-1"><div><span className="text-muted-foreground">Active: </span><span className={diagnostic.user.is_active ? 'text-emerald-400' : 'text-rose-400'}>{diagnostic.user.is_active ? 'Yes' : 'No'}</span></div><div><span className="text-muted-foreground">Locked: </span><span className={diagnostic.user.is_locked ? 'text-amber-400' : 'text-emerald-400'}>{diagnostic.user.is_locked ? 'Yes' : 'No'}</span></div>{diagnostic.user.managed_by && <div><span className="text-muted-foreground">Manager: </span><span className="text-foreground">{diagnostic.user.managed_by.email}</span></div>}</div>
                <div className="space-y-2">{diagnostic.agents.map((ag) => (<div key={ag.agent_id} className="rounded-lg bg-muted/20 border border-border/30 px-4 py-2.5 flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{ag.agent_name}</div>{ag.access_via && <div className="text-[11px] text-muted-foreground">via {ag.access_via}</div>}{ag.block_reasons.length > 0 && <div className="mt-1 space-y-0.5">{ag.block_reasons.map((r, i) => <div key={i} className="text-[11px] text-rose-400">{r}</div>)}</div>}</div><div className="shrink-0 mt-0.5">{ag.has_access ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : ag.block_reasons.length > 0 ? <XCircle className="h-4 w-4 text-rose-400" /> : <AlertCircle className="h-4 w-4 text-muted-foreground" />}</div></div>))}</div>
              </div>
            ) : null}
          <DialogFooter><Button variant="ghost" onClick={() => setDiagnosticUser(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Registrations: confirm approve/reject ── */}
      <Dialog open={!!decideTarget} onOpenChange={o => { if (!o) { setDecideTarget(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>{decideTarget?.action === 'approve' ? '✅ Approve Admin' : '❌ Reject Admin'}</DialogTitle>
            <DialogDescription>{decideTarget?.reg.email}</DialogDescription>
          </DialogHeader>
          {decideTarget?.action === 'approve' ? (
            <p style={{ fontSize: 14, color: 'rgba(120,170,220,0.7)', lineHeight: 1.6 }}>This will activate the admin account and send them a confirmation email so they can log in.</p>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: 'rgba(120,170,220,0.7)', lineHeight: 1.6, marginBottom: 12 }}>The admin will receive a rejection email. Optionally provide a reason.</p>
              <textarea placeholder="Reason for rejection (optional)…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                style={{ width: '100%', background: 'rgba(0,20,50,0.8)', border: '1px solid rgba(0,100,180,0.3)', borderRadius: 9, padding: '10px 12px', fontSize: 13, color: '#E8F4FF', outline: 'none', resize: 'none' as const, boxSizing: 'border-box' as const }} />
            </div>
          )}
          <DialogFooter style={{ gap: 8 }}>
            <Button variant="ghost" onClick={() => { setDecideTarget(null); setRejectReason(''); }}>Cancel</Button>
            <Button onClick={() => decideTarget && decide.mutate({ id: decideTarget.reg.id, action: decideTarget.action, reason: rejectReason || undefined })} disabled={decide.isPending}
              style={decideTarget?.action === 'approve' ? { background: 'rgba(0,200,100,0.15)', border: '1px solid rgba(0,200,100,0.3)', color: '#00CC66' } : { background: 'rgba(255,60,60,0.12)', border: '1px solid rgba(255,60,60,0.3)', color: '#FF6060' }}>
              {decide.isPending ? 'Processing…' : decideTarget?.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Usage: set time limit ── */}
      <Dialog open={limitDialog} onOpenChange={setLimitDialog}>
        <DialogContent className="sm:max-w-md bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-amber-400" /> Set Time Limit</DialogTitle>
            <DialogDescription>Restrict an admin&apos;s usage on a specific agent</DialogDescription>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (!limitForm.agent_id || !limitForm.target_user_id || !limitForm.limit_minutes) return; setLimitMutation.mutate({ agent_id: limitForm.agent_id, target_user_id: limitForm.target_user_id, limit_minutes: parseInt(limitForm.limit_minutes) }); }} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label style={S.label}>Admin</label>
              <Select value={limitForm.target_user_id} onValueChange={v => setLimitForm(f => ({ ...f, target_user_id: v }))}>
                <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue placeholder="Select admin…" /></SelectTrigger>
                <SelectContent className="bg-[#0A1428] border-border/40">
                  {(adminsForLimit as ApiUser[]).map(a => <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label style={S.label}>Agent</label>
              <Select value={limitForm.agent_id} onValueChange={v => setLimitForm(f => ({ ...f, agent_id: v }))}>
                <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue placeholder="Select agent…" /></SelectTrigger>
                <SelectContent className="bg-[#0A1428] border-border/40">
                  {(agents as Agent[]).map(a => <SelectItem key={a.id} value={a.id}><span className="flex items-center gap-2"><Bot className="h-3.5 w-3.5 text-primary" />{a.name}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label style={S.label}>Max Minutes</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input type="number" min="1" placeholder="e.g. 60" className="pl-9 bg-muted/40 border-border/40" value={limitForm.limit_minutes} onChange={e => setLimitForm(f => ({ ...f, limit_minutes: e.target.value }))} required />
              </div>
              <p style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)' }}>Admin and all their users will be blocked once this limit is reached</p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setLimitDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={setLimitMutation.isPending} className="min-w-24">{setLimitMutation.isPending ? 'Saving…' : 'Set Limit'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
