'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLogout } from '@/lib/hooks/use-auth';
import { useAllOrgs, useToggleOrgAgent } from '@/lib/hooks/use-organizations';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  agentsApi, integrationsApi, organizationsApi, usersApi,
  type Organization, type Agent, type IntegrationProvider,
  type CreateAgentPayload, type OrgAgentAccess, type ApiUser, type AccessDiagnostic,
} from '@/lib/api-client';
import {
  Building2, Bot, Users, ShieldAlert, LogOut, Power, PowerOff,
  ChevronDown, ChevronRight, Plus, Trash2, Plug, Key, Settings2,
  Pencil, Lock, Unlock, UserCog, BarChart2, Search, ShieldOff, Shield,
  CheckCircle2, AlertCircle, XCircle, RefreshCw,
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
  field_schema_raw: string; // JSON string for apikey field_schema
}

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

// ─── Presets ──────────────────────────────────────────────────────────────────
const PRESETS: Array<{ provider: string; display_name: string; auth_type: 'oauth2' | 'apikey'; oauth_config?: OAuthFormConfig }> = [
  { provider: 'jira',       display_name: 'Jira',       auth_type: 'oauth2', oauth_config: { auth_url: 'https://auth.atlassian.com/authorize', token_url: 'https://auth.atlassian.com/oauth/token', scopes: 'read:jira-work write:jira-work read:jira-user offline_access', client_id_setting: 'JIRA_CLIENT_ID', client_secret_setting: 'JIRA_CLIENT_SECRET', extra_params: 'audience=api.atlassian.com\nprompt=consent' } },
  { provider: 'asana',      display_name: 'Asana',      auth_type: 'oauth2', oauth_config: { auth_url: 'https://app.asana.com/-/oauth_authorize', token_url: 'https://app.asana.com/-/oauth_token', scopes: 'default', client_id_setting: 'ASANA_CLIENT_ID', client_secret_setting: 'ASANA_CLIENT_SECRET', extra_params: '' } },
  { provider: 'github',     display_name: 'GitHub',     auth_type: 'oauth2', oauth_config: { auth_url: 'https://github.com/login/oauth/authorize', token_url: 'https://github.com/login/oauth/access_token', scopes: 'repo read:user', client_id_setting: 'GITHUB_CLIENT_ID', client_secret_setting: 'GITHUB_CLIENT_SECRET', extra_params: '' } },
  { provider: 'slack',      display_name: 'Slack',      auth_type: 'oauth2', oauth_config: { auth_url: 'https://slack.com/oauth/v2/authorize', token_url: 'https://slack.com/api/oauth.v2.access', scopes: 'channels:read chat:write', client_id_setting: 'SLACK_CLIENT_ID', client_secret_setting: 'SLACK_CLIENT_SECRET', extra_params: '' } },
  { provider: 'notion',     display_name: 'Notion',     auth_type: 'oauth2', oauth_config: { auth_url: 'https://api.notion.com/v1/oauth/authorize', token_url: 'https://api.notion.com/v1/oauth/token', scopes: '', client_id_setting: 'NOTION_CLIENT_ID', client_secret_setting: 'NOTION_CLIENT_SECRET', extra_params: '' } },
  { provider: 'hubspot',    display_name: 'HubSpot',    auth_type: 'oauth2', oauth_config: { auth_url: 'https://app.hubspot.com/oauth/authorize', token_url: 'https://api.hubapi.com/oauth/v1/token', scopes: 'crm.objects.contacts.read', client_id_setting: 'HUBSPOT_CLIENT_ID', client_secret_setting: 'HUBSPOT_CLIENT_SECRET', extra_params: '' } },
  { provider: 'salesforce', display_name: 'Salesforce', auth_type: 'oauth2', oauth_config: { auth_url: 'https://login.salesforce.com/services/oauth2/authorize', token_url: 'https://login.salesforce.com/services/oauth2/token', scopes: 'api refresh_token', client_id_setting: 'SALESFORCE_CLIENT_ID', client_secret_setting: 'SALESFORCE_CLIENT_SECRET', extra_params: '' } },
  { provider: 'trello',     display_name: 'Trello',     auth_type: 'apikey' },
  { provider: 'airtable',   display_name: 'Airtable',   auth_type: 'apikey' },
  { provider: 'custom',     display_name: 'Custom',     auth_type: 'apikey' },
];

const BLANK_OAUTH: OAuthFormConfig = { auth_url: '', token_url: '', scopes: '', client_id_setting: '', client_secret_setting: '', extra_params: '' };
const BLANK_AGENT: CreateAgentPayload = { name: '', subtitle: '', description: '', agent_type: 'automation', status: 'live', is_active: true };
const BLANK_PROVIDER: ProviderFormState = { provider: '', display_name: '', logo_url: '', auth_type: 'apikey', oauth_config: { ...BLANK_OAUTH }, field_schema_raw: '' };

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:   { minHeight: '100vh', background: '#020B18', fontFamily: 'Inter, sans-serif', color: '#E8F4FF' },
  header: { borderBottom: '1px solid rgba(255,180,0,0.2)', background: 'rgba(0,10,30,0.9)', backdropFilter: 'blur(20px)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky' as const, top: 0, zIndex: 50 },
  main:   { maxWidth: 1280, margin: '0 auto', padding: '40px 32px' },
  card:   { borderRadius: 14, background: 'rgba(0,15,40,0.8)', border: '1px solid rgba(0,100,180,0.2)', padding: '20px 24px' },
  label:  { fontSize: 11, fontWeight: 700, color: 'rgba(120,170,220,0.6)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 5, display: 'block' },
  th:     { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(120,170,220,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid rgba(0,100,180,0.15)', whiteSpace: 'nowrap' as const },
  td:     { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid rgba(0,100,180,0.08)', verticalAlign: 'middle' as const },
};

const roleBadge = (role: string) => {
  const map: Record<string, string> = { superadmin: '#FFB400', admin: '#A78BFA', user: '#00D4FF' };
  const c = map[role] ?? '#888';
  return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: `${c}18`, color: c, border: `1px solid ${c}30`, fontWeight: 700 }}>{role}</span>;
};

// ══════════════════════════════════════════════════════════════════════════════
export default function SuperadminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const logout = useLogout();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'superadmin') router.push('/admin/dashboard');
  }, [user, loading, router]);

  // ── Shared data ─────────────────────────────────────────────────────────────
  const { data: orgs = [], isLoading: orgsLoading } = useAllOrgs();
  const { data: agents = [] } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => agentsApi.list({ page_size: 100 }),
    select: (d) => d.results ?? [],
    enabled: !!user,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AGENTS TAB
  // ════════════════════════════════════════════════════════════════════════════
  const [agentDialog, setAgentDialog] = useState<{ mode: 'create' | 'edit'; agent?: Agent } | null>(null);
  const [agentForm, setAgentForm] = useState<CreateAgentPayload>(BLANK_AGENT);
  const [deleteAgentSlug, setDeleteAgentSlug] = useState<string | null>(null);

  const openCreateAgent = () => { setAgentForm(BLANK_AGENT); setAgentDialog({ mode: 'create' }); };
  const openEditAgent = (a: Agent) => {
    setAgentForm({ name: a.name, subtitle: a.subtitle ?? '', description: a.description ?? '', agent_type: a.agent_type, status: a.status, latency: a.latency, efficiency: a.efficiency, is_active: a.is_active, config: a.config });
    setAgentDialog({ mode: 'edit', agent: a });
  };

  const saveAgent = useMutation({
    mutationFn: (f: CreateAgentPayload) =>
      agentDialog?.mode === 'edit' && agentDialog.agent
        ? agentsApi.update(agentDialog.agent.slug, f)
        : agentsApi.create(f),
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

  // ─ Providers ────────────────────────────────────────────────────────────────
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
    if (providerForm.auth_type === 'oauth2') {
      return { ...base, oauth_config: { auth_url: providerForm.oauth_config.auth_url, token_url: providerForm.oauth_config.token_url, scopes: scopesToArray(providerForm.oauth_config.scopes), client_id_setting: providerForm.oauth_config.client_id_setting, client_secret_setting: providerForm.oauth_config.client_secret_setting, ...(providerForm.oauth_config.extra_params.trim() && { extra_params: extraParamsToRecord(providerForm.oauth_config.extra_params) }) } };
    }
    const fs = (() => { try { return providerForm.field_schema_raw.trim() ? JSON.parse(providerForm.field_schema_raw) : []; } catch { return []; } })();
    return { ...base, field_schema: fs };
  };

  const addProvider = useMutation({
    mutationFn: (data: Parameters<typeof integrationsApi.createAdminProvider>[0]) => integrationsApi.createAdminProvider(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers', providerAgentId] }); toast.success('Provider added'); closeProviderForm(); },
    onError: () => toast.error('Failed to add provider'),
  });

  const updateProvider = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof integrationsApi.updateAdminProvider>[1] }) => integrationsApi.updateAdminProvider(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers', providerAgentId] }); toast.success('Provider updated'); closeProviderForm(); },
    onError: () => toast.error('Failed to update provider'),
  });

  const deleteProvider = useMutation({
    mutationFn: integrationsApi.deleteAdminProvider,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers', providerAgentId] }); toast.success('Provider removed'); },
    onError: () => toast.error('Failed to remove provider'),
  });

  const openEditProvider = (p: IntegrationProvider) => {
    setEditingProviderId(p.id);
    setPresetChoice('');
    setProviderForm({ provider: p.provider, display_name: p.display_name, logo_url: p.logo_url ?? '', auth_type: p.auth_type, oauth_config: oauthFormFromProvider(p), field_schema_raw: p.field_schema?.length ? JSON.stringify(p.field_schema, null, 2) : '' });
    setAddProviderOpen(true);
  };

  const applyPreset = (v: string) => {
    setPresetChoice(v);
    if (v === '__custom__') { setProviderForm((f) => ({ ...f, provider: '', display_name: '', oauth_config: { ...BLANK_OAUTH } })); return; }
    const p = PRESETS.find((x) => x.provider === v);
    if (p) setProviderForm((f) => ({ ...f, provider: p.provider, display_name: p.display_name, auth_type: p.auth_type, oauth_config: p.oauth_config ? { ...p.oauth_config } : { ...BLANK_OAUTH } }));
  };

  const oauthValid = providerForm.auth_type !== 'oauth2' || (
    !!providerForm.oauth_config.auth_url.trim() && !!providerForm.oauth_config.token_url.trim() &&
    !!providerForm.oauth_config.client_id_setting.trim() && !!providerForm.oauth_config.client_secret_setting.trim()
  );
  const providerBusy = addProvider.isPending || updateProvider.isPending;

  // ════════════════════════════════════════════════════════════════════════════
  // ORGANIZATIONS TAB
  // ════════════════════════════════════════════════════════════════════════════
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgActiveDialog, setOrgActiveDialog] = useState<Organization | null>(null);

  const { data: orgAgentAccess = [], isFetching: orgAgentsFetching } = useQuery({
    queryKey: ['org-agents', expandedOrg],
    queryFn: () => organizationsApi.listOrgAgentAccess(expandedOrg!),
    enabled: !!expandedOrg,
  });

  const updateOrgActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => organizationsApi.updateById(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org', 'all'] }); toast.success('Organization updated'); setOrgActiveDialog(null); },
    onError: () => toast.error('Failed to update organization'),
  });

  const [toggleOrgAgentDialog, setToggleOrgAgentDialog] = useState<{ orgId: string; orgName: string; agentId: string; agentName: string; current: boolean } | null>(null);
  const toggleOrgAgent = useToggleOrgAgent();

  // ════════════════════════════════════════════════════════════════════════════
  // USERS TAB
  // ════════════════════════════════════════════════════════════════════════════
  const [userSearch, setUserSearch]         = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userPage, setUserPage]             = useState(1);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users-all', userPage, userSearch, userRoleFilter, userStatusFilter],
    queryFn: () => usersApi.list({
      page: userPage, page_size: 20,
      search: userSearch || undefined,
      role: userRoleFilter !== 'all' ? userRoleFilter : undefined,
      is_active: userStatusFilter === 'active' ? 'true' : userStatusFilter === 'inactive' ? 'false' : undefined,
    }),
    enabled: !!user,
    placeholderData: (prev) => prev,
  });
  const userList: ApiUser[] = usersData?.results ?? [];
  const userTotal = usersData?.count ?? 0;
  const userPages = Math.ceil(userTotal / 20);

  // Admins list (for assign-manager)
  const { data: adminsList = [] } = useQuery({
    queryKey: ['users-admins'],
    queryFn: () => usersApi.list({ role: 'admin', page_size: 100 }),
    select: (d) => d.results ?? [],
    enabled: !!user,
  });

  // dialogs
  const [roleDialog,       setRoleDialog]       = useState<ApiUser | null>(null);
  const [newRole,          setNewRole]           = useState<string>('');
  const [lockDialog,       setLockDialog]        = useState<ApiUser | null>(null);
  const [lockMinutes,      setLockMinutes]       = useState('60');
  const [managerDialog,    setManagerDialog]     = useState<ApiUser | null>(null);
  const [managerId,        setManagerId]         = useState<string>('__none__');
  const [confirmDialog,    setConfirmDialog]     = useState<{ user: ApiUser; action: 'unlock' | 'activate' | 'deactivate' } | null>(null);
  const [diagnosticUser,   setDiagnosticUser]    = useState<ApiUser | null>(null);

  const { data: diagnostic, isFetching: diagLoading } = useQuery<AccessDiagnostic>({
    queryKey: ['diagnostic', diagnosticUser?.id],
    queryFn: () => usersApi.accessDiagnostic(diagnosticUser!.id),
    enabled: !!diagnosticUser,
  });

  const invalidateUsers = () => qc.invalidateQueries({ queryKey: ['users-all'] });

  const changeRole = useMutation({
    mutationFn: () => usersApi.updateRole(roleDialog!.id, newRole),
    onSuccess: () => { invalidateUsers(); toast.success('Role updated'); setRoleDialog(null); },
    onError: () => toast.error('Failed to update role'),
  });

  const lockUser = useMutation({
    mutationFn: () => usersApi.lock(lockDialog!.id, parseInt(lockMinutes, 10)),
    onSuccess: () => { invalidateUsers(); toast.success('User locked'); setLockDialog(null); },
    onError: () => toast.error('Failed to lock user'),
  });

  const confirmAction = useMutation({
    mutationFn: () => {
      if (!confirmDialog) return Promise.resolve();
      const { user: u, action } = confirmDialog;
      if (action === 'unlock')     return usersApi.unlock(u.id);
      if (action === 'activate')   return usersApi.activate(u.id);
      if (action === 'deactivate') return usersApi.deactivate(u.id);
      return Promise.resolve();
    },
    onSuccess: () => { invalidateUsers(); toast.success('Done'); setConfirmDialog(null); },
    onError: () => toast.error('Action failed'),
  });

  const assignManager = useMutation({
    mutationFn: () => usersApi.assignManager(managerDialog!.id, managerId === '__none__' ? null : managerId),
    onSuccess: () => { invalidateUsers(); toast.success('Manager updated'); setManagerDialog(null); },
    onError: () => toast.error('Failed to assign manager'),
  });

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #00D4FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* ─ Header ─ */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,180,0,0.12)', border: '1px solid rgba(255,180,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={16} color="#FFB400" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#FFB400' }}>Superadmin</span>
          <span style={{ fontSize: 12, color: 'rgba(255,180,0,0.4)' }}>Life Science AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'rgba(160,200,240,0.5)' }}>{user.email}</span>
          <button onClick={() => logout.mutate()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 8, color: 'rgba(255,100,100,0.8)', fontSize: 13, cursor: 'pointer' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main style={S.main}>

        {/* ─ Stats ─ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 36 }}>
          {[
            { label: 'Organizations', value: orgs.length, icon: Building2, color: '#FFB400' },
            { label: 'Agents',        value: agents.length, icon: Bot, color: '#00D4FF' },
            { label: 'Members',       value: orgs.reduce((s, o) => s + o.member_count, 0), icon: Users, color: '#A78BFA' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.45)', marginTop: 1 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════ TABS */}
        <Tabs defaultValue="agents">
          <TabsList className="bg-muted/20 border border-border/30 mb-6">
            <TabsTrigger value="agents"        className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-300 gap-2"><Bot size={14} /> Agents ({agents.length})</TabsTrigger>
            <TabsTrigger value="organizations" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 gap-2"><Building2 size={14} /> Organizations ({orgs.length})</TabsTrigger>
            <TabsTrigger value="users"         className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300 gap-2"><Users size={14} /> Users</TabsTrigger>
          </TabsList>

          {/* ══════════════════════════ AGENTS TAB ══════════════════════════ */}
          <TabsContent value="agents">
            <div className="flex justify-between items-center mb-4">
              <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)' }}>Create agents, define their integrations and manage global status.</p>
              <Button onClick={openCreateAgent} className="bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 gap-2">
                <Plus size={14} /> Create Agent
              </Button>
            </div>

            {agents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(120,170,220,0.3)' }}>No agents yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                {(agents as Agent[]).map((a) => (
                  <div key={a.id} style={{ ...S.card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Bot size={15} color="#00D4FF" />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</div>
                          {a.subtitle && <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)' }}>{a.subtitle}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: a.is_active ? 'rgba(0,255,136,0.08)' : 'rgba(255,80,80,0.08)', color: a.is_active ? '#00FF88' : '#FF5050', border: `1px solid ${a.is_active ? 'rgba(0,255,136,0.2)' : 'rgba(255,80,80,0.2)'}`, fontWeight: 700 }}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,100,180,0.12)', color: 'rgba(120,170,220,0.7)', border: '1px solid rgba(0,100,180,0.2)' }}>{a.status}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      <button onClick={() => { setProviderAgentId(a.id); setProviderAgentName(a.name); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#A78BFA', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <Settings2 size={12} /> Integrations
                      </button>
                      <button onClick={() => openEditAgent(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(0,212,255,0.25)', background: 'rgba(0,212,255,0.06)', color: '#00D4FF', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => toggleAgent.mutate(a.slug)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${a.is_active ? 'rgba(255,80,80,0.25)' : 'rgba(0,255,136,0.25)'}`, background: a.is_active ? 'rgba(255,80,80,0.06)' : 'rgba(0,255,136,0.06)', color: a.is_active ? '#FF5050' : '#00FF88', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        {a.is_active ? <PowerOff size={12} /> : <Power size={12} />}{a.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => setDeleteAgentSlug(a.slug)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,80,80,0.2)', background: 'rgba(255,80,80,0.05)', color: '#FF5050', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ══════════════════════════ ORGANIZATIONS TAB ══════════════════════════ */}
          <TabsContent value="organizations">
            <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)', marginBottom: 16 }}>Activate/deactivate orgs and control per-org agent access.</p>
            {orgsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(120,170,220,0.4)' }}>Loading…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orgs.map((org) => (
                  <div key={org.id} style={{ borderRadius: 12, background: 'rgba(0,15,40,0.8)', border: '1px solid rgba(0,100,180,0.2)', overflow: 'hidden' }}>
                    {/* Org row */}
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <button onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(120,170,220,0.5)', padding: 0 }}>
                        {expandedOrg === org.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={16} color="#FFB400" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{org.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)' }}>{org.owner_email} · {org.member_count} members · {org.plan.display_name}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: org.is_active ? 'rgba(0,255,136,0.08)' : 'rgba(255,80,80,0.08)', color: org.is_active ? '#00FF88' : '#FF5050', border: `1px solid ${org.is_active ? 'rgba(0,255,136,0.2)' : 'rgba(255,80,80,0.2)'}`, fontWeight: 700 }}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => setOrgActiveDialog(org)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: `1px solid ${org.is_active ? 'rgba(255,80,80,0.3)' : 'rgba(0,255,136,0.3)'}`, background: org.is_active ? 'rgba(255,80,80,0.06)' : 'rgba(0,255,136,0.06)', color: org.is_active ? '#FF5050' : '#00FF88', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {org.is_active ? <ShieldOff size={12} /> : <Shield size={12} />}{org.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>

                    {/* Agent kill-switch panel */}
                    {expandedOrg === org.id && (
                      <div style={{ borderTop: '1px solid rgba(0,100,180,0.12)', padding: '14px 20px', background: 'rgba(0,10,28,0.5)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(120,170,220,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Agent Kill Switches</div>
                        {orgAgentsFetching ? (
                          <div style={{ fontSize: 13, color: 'rgba(120,170,220,0.4)', padding: '8px 0' }}><RefreshCw size={13} style={{ display: 'inline', marginRight: 6, animation: 'spin 1s linear infinite' }} />Loading…</div>
                        ) : orgAgentAccess.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'rgba(120,170,220,0.35)' }}>No agents assigned to this org yet.</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 8 }}>
                            {(orgAgentAccess as OrgAgentAccess[]).map((item) => (
                              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 13px', borderRadius: 9, background: 'rgba(0,20,50,0.7)', border: '1px solid rgba(0,100,180,0.15)' }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.agent_name}</div>
                                  {item.disabled_by_email && <div style={{ fontSize: 10, color: 'rgba(255,80,80,0.6)', marginTop: 1 }}>Off by {item.disabled_by_email}</div>}
                                </div>
                                <button
                                  onClick={() => setToggleOrgAgentDialog({ orgId: org.id, orgName: org.name, agentId: item.agent, agentName: item.agent_name, current: item.is_enabled })}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: `1px solid ${item.is_enabled ? 'rgba(0,255,136,0.25)' : 'rgba(255,80,80,0.25)'}`, background: item.is_enabled ? 'rgba(0,255,136,0.07)' : 'rgba(255,80,80,0.07)', color: item.is_enabled ? '#00FF88' : '#FF5050', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  {item.is_enabled ? <Power size={10} /> : <PowerOff size={10} />}{item.is_enabled ? 'On' : 'Off'}
                                </button>
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
          </TabsContent>

          {/* ══════════════════════════ USERS TAB ══════════════════════════ */}
          <TabsContent value="users">
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
              <div style={{ position: 'relative' as const, flex: '1 1 220px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(120,170,220,0.4)' }} />
                <input value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} placeholder="Search email…" style={{ ...S.card, padding: '9px 12px 9px 32px', fontSize: 13, width: '100%', background: 'rgba(0,15,40,0.7)', color: '#E8F4FF', outline: 'none' }} />
              </div>
              <select value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }} style={{ ...S.card, padding: '9px 14px', fontSize: 12, cursor: 'pointer', background: 'rgba(0,15,40,0.7)', color: '#E8F4FF', outline: 'none' }}>
                <option value="all">All roles</option>
                <option value="superadmin">Superadmin</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
              <select value={userStatusFilter} onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }} style={{ ...S.card, padding: '9px 14px', fontSize: 12, cursor: 'pointer', background: 'rgba(0,15,40,0.7)', color: '#E8F4FF', outline: 'none' }}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.4)', alignSelf: 'center', marginLeft: 'auto' }}>{userTotal} users</div>
            </div>

            {/* Table */}
            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                        <tr key={u.id} style={{ transition: 'background 0.1s' }}>
                          <td style={S.td}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{u.email}</div>
                            <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.4)' }}>joined {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}</div>
                          </td>
                          <td style={S.td}>{roleBadge(u.role)}</td>
                          <td style={S.td}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {isLocked
                                ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,180,0,0.1)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.25)', fontWeight: 700 }}>Locked</span>
                                : u.is_active
                                  ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)', fontWeight: 700 }}>Active</span>
                                  : <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,80,80,0.08)', color: '#FF5050', border: '1px solid rgba(255,80,80,0.2)', fontWeight: 700 }}>Inactive</span>
                              }
                              {!u.is_verified && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(120,120,120,0.1)', color: 'rgba(120,170,220,0.5)', border: '1px solid rgba(120,120,120,0.2)', fontWeight: 700 }}>Unverified</span>}
                            </div>
                          </td>
                          <td style={{ ...S.td, fontSize: 12, color: 'rgba(120,170,220,0.6)' }}>
                            {u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ ...S.td, fontSize: 12, color: 'rgba(120,170,220,0.55)' }}>
                            {u.managed_by?.email ?? '—'}
                          </td>
                          <td style={{ ...S.td, textAlign: 'right' as const }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {/* Change role */}
                              <button title="Change role" onClick={() => { setRoleDialog(u); setNewRole(u.role); }} style={{ padding: '5px', borderRadius: 6, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#A78BFA', cursor: 'pointer' }}>
                                <UserCog size={13} />
                              </button>
                              {/* Lock / Unlock */}
                              {isLocked
                                ? <button title="Unlock" onClick={() => setConfirmDialog({ user: u, action: 'unlock' })} style={{ padding: '5px', borderRadius: 6, background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)', color: '#FFB400', cursor: 'pointer' }}><Unlock size={13} /></button>
                                : <button title="Lock user" onClick={() => { setLockDialog(u); setLockMinutes('60'); }} style={{ padding: '5px', borderRadius: 6, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF7070', cursor: 'pointer' }}><Lock size={13} /></button>
                              }
                              {/* Activate / Deactivate */}
                              {u.is_active
                                ? <button title="Deactivate" onClick={() => setConfirmDialog({ user: u, action: 'deactivate' })} style={{ padding: '5px', borderRadius: 6, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF5050', cursor: 'pointer' }}><PowerOff size={13} /></button>
                                : <button title="Activate" onClick={() => setConfirmDialog({ user: u, action: 'activate' })} style={{ padding: '5px', borderRadius: 6, background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.2)', color: '#00FF88', cursor: 'pointer' }}><Power size={13} /></button>
                              }
                              {/* Assign manager */}
                              <button title="Assign manager" onClick={() => { setManagerDialog(u); setManagerId(u.managed_by?.id ?? '__none__'); }} style={{ padding: '5px', borderRadius: 6, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00D4FF', cursor: 'pointer' }}>
                                <Users size={13} />
                              </button>
                              {/* Access diagnostic */}
                              <button title="Access diagnostic" onClick={() => setDiagnosticUser(u)} style={{ padding: '5px', borderRadius: 6, background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)', color: '#FFB400', cursor: 'pointer' }}>
                                <BarChart2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {userPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid rgba(0,100,180,0.12)' }}>
                  <button disabled={userPage === 1} onClick={() => setUserPage((p) => p - 1)} style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(0,100,180,0.15)', border: '1px solid rgba(0,100,180,0.2)', color: '#E8F4FF', fontSize: 12, cursor: userPage === 1 ? 'not-allowed' : 'pointer', opacity: userPage === 1 ? 0.4 : 1 }}>← Prev</button>
                  <span style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)', alignSelf: 'center' }}>Page {userPage} of {userPages}</span>
                  <button disabled={userPage === userPages} onClick={() => setUserPage((p) => p + 1)} style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(0,100,180,0.15)', border: '1px solid rgba(0,100,180,0.2)', color: '#E8F4FF', fontSize: 12, cursor: userPage === userPages ? 'not-allowed' : 'pointer', opacity: userPage === userPages ? 0.4 : 1 }}>Next →</button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* ════════════════════════ DIALOGS ════════════════════════ */}

      {/* ─ Create / Edit Agent ─ */}
      <Dialog open={!!agentDialog} onOpenChange={(o) => !o && setAgentDialog(null)}>
        <DialogContent className="sm:max-w-125 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>{agentDialog?.mode === 'edit' ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
            <DialogDescription>Configure the agent&apos;s details and deployment settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={S.label}>Name *</label>
                <Input value={agentForm.name} onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))} placeholder="Project Tracking Agent" className="bg-muted/40 border-border/40" />
              </div>
              <div>
                <label style={S.label}>Subtitle</label>
                <Input value={agentForm.subtitle ?? ''} onChange={(e) => setAgentForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Short tagline" className="bg-muted/40 border-border/40" />
              </div>
            </div>
            <div>
              <label style={S.label}>Description</label>
              <Input value={agentForm.description ?? ''} onChange={(e) => setAgentForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this agent does" className="bg-muted/40 border-border/40" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label style={S.label}>Type</label>
                <Select value={agentForm.agent_type} onValueChange={(v) => setAgentForm((f) => ({ ...f, agent_type: v as Agent['agent_type'] }))}>
                  <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                    {['chatbot','assistant','analyzer','automation','custom'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={S.label}>Status</label>
                <Select value={agentForm.status ?? 'live'} onValueChange={(v) => setAgentForm((f) => ({ ...f, status: v as Agent['status'] }))}>
                  <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                    {['live','offline','maintenance'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={S.label}>Latency</label>
                <Select value={agentForm.latency ?? 'fast'} onValueChange={(v) => setAgentForm((f) => ({ ...f, latency: v as Agent['latency'] }))}>
                  <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                    {['instant','fast','moderate','slow'].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label style={S.label}>Efficiency (0-100)</label>
              <Input type="number" min={0} max={100} value={agentForm.efficiency ?? 90} onChange={(e) => setAgentForm((f) => ({ ...f, efficiency: parseInt(e.target.value, 10) }))} className="bg-muted/40 border-border/40" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAgentDialog(null)}>Cancel</Button>
            <Button className="bg-sky-500 hover:bg-sky-600 text-black font-bold" disabled={!agentForm.name.trim() || saveAgent.isPending} onClick={() => saveAgent.mutate(agentForm)}>
              {saveAgent.isPending ? 'Saving…' : agentDialog?.mode === 'edit' ? 'Save Changes' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Delete Agent Confirm ─ */}
      <Dialog open={!!deleteAgentSlug} onOpenChange={(o) => !o && setDeleteAgentSlug(null)}>
        <DialogContent className="sm:max-w-100 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-rose-400">Delete Agent</DialogTitle>
            <DialogDescription>This is permanent. All access grants for this agent will also be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteAgentSlug(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteAgent.isPending} onClick={() => deleteAgent.mutate(deleteAgentSlug!)}>
              {deleteAgent.isPending ? 'Deleting…' : 'Delete Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Manage Integration Providers ─ */}
      <Dialog open={!!providerAgentId} onOpenChange={(o) => { if (!o) { setProviderAgentId(null); setAddProviderOpen(false); } }}>
        <DialogContent className="sm:max-w-145 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plug className="h-4 w-4 text-violet-400" /> Integrations — {providerAgentName}</DialogTitle>
            <DialogDescription>Define which tools admins can connect for this agent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-52 overflow-y-auto py-1">
            {providersLoading ? <div className="text-sm text-muted-foreground text-center py-4">Loading…</div>
              : agentProviders.length === 0 ? <div className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2"><Plug className="h-8 w-8 opacity-20" />No integrations defined yet.</div>
              : agentProviders.map((p: IntegrationProvider) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/20 border border-border/30 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {p.logo_url ? <img src={p.logo_url} alt="" className="w-6 h-6 rounded object-contain" /> : <div className="w-6 h-6 rounded bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">{p.auth_type === 'oauth2' ? <Key className="h-3 w-3 text-violet-400" /> : <Plug className="h-3 w-3 text-violet-400" />}</div>}
                    <span className="text-sm font-semibold">{p.display_name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{p.provider}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/5">{p.auth_type === 'oauth2' ? 'OAuth 2.0' : 'API Key'}</Badge>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-sky-400 hover:bg-sky-500/10" onClick={() => openEditProvider(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-500/10" disabled={deleteProvider.isPending} onClick={() => deleteProvider.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))
            }
          </div>

          {addProviderOpen ? (
            <div className="border border-border/40 rounded-xl p-4 space-y-3 bg-muted/10 max-h-96 overflow-y-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{editingProviderId ? 'Edit Integration' : 'Add Integration'}</p>
              {!editingProviderId && (
                <div>
                  <label style={S.label}>Quick-pick preset</label>
                  <Select value={presetChoice} onValueChange={applyPreset}>
                    <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue placeholder="Choose a preset…" /></SelectTrigger>
                    <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                      {PRESETS.map((p) => <SelectItem key={p.provider} value={p.provider}>{p.display_name}</SelectItem>)}
                      <SelectItem value="__custom__">Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={S.label}>Provider slug *</label>
                  <Input value={providerForm.provider} onChange={(e) => setProviderForm((f) => ({ ...f, provider: e.target.value }))} placeholder="jira" disabled={!!editingProviderId} className="bg-muted/40 border-border/40 disabled:opacity-50" />
                </div>
                <div>
                  <label style={S.label}>Display name *</label>
                  <Input value={providerForm.display_name} onChange={(e) => setProviderForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Jira" className="bg-muted/40 border-border/40" />
                </div>
              </div>
              <div>
                <label style={S.label}>Logo URL</label>
                <Input value={providerForm.logo_url} onChange={(e) => setProviderForm((f) => ({ ...f, logo_url: e.target.value }))} placeholder="https://cdn.example.com/jira.png" className="bg-muted/40 border-border/40 text-xs" />
              </div>
              <div>
                <label style={S.label}>Auth type</label>
                <Select value={providerForm.auth_type} onValueChange={(v) => setProviderForm((f) => ({ ...f, auth_type: v as 'oauth2' | 'apikey' }))}>
                  <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                    <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    <SelectItem value="apikey">API Key</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {providerForm.auth_type === 'oauth2' && (
                <div className="space-y-3 pt-1 border-t border-border/30">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-violet-400/70 pt-1">OAuth 2.0 Config</p>
                  <div><label style={S.label}>Authorization URL *</label><Input value={providerForm.oauth_config.auth_url} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, auth_url: e.target.value } }))} placeholder="https://provider.com/oauth/authorize" className="bg-muted/40 border-border/40 font-mono text-xs" /></div>
                  <div><label style={S.label}>Token URL *</label><Input value={providerForm.oauth_config.token_url} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, token_url: e.target.value } }))} placeholder="https://provider.com/oauth/token" className="bg-muted/40 border-border/40 font-mono text-xs" /></div>
                  <div><label style={S.label}>Scopes (space/comma separated)</label><Input value={providerForm.oauth_config.scopes} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, scopes: e.target.value } }))} placeholder="read:jira-work write:jira-work offline_access" className="bg-muted/40 border-border/40" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label style={S.label}>Client ID env var *</label><Input value={providerForm.oauth_config.client_id_setting} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, client_id_setting: e.target.value } }))} placeholder="JIRA_CLIENT_ID" className="bg-muted/40 border-border/40 font-mono text-xs" /></div>
                    <div><label style={S.label}>Client secret env var *</label><Input value={providerForm.oauth_config.client_secret_setting} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, client_secret_setting: e.target.value } }))} placeholder="JIRA_CLIENT_SECRET" className="bg-muted/40 border-border/40 font-mono text-xs" /></div>
                  </div>
                  <div>
                    <label style={S.label}>Extra params (key=value per line)</label>
                    <textarea value={providerForm.oauth_config.extra_params} onChange={(e) => setProviderForm((f) => ({ ...f, oauth_config: { ...f.oauth_config, extra_params: e.target.value } }))} placeholder={'audience=api.atlassian.com\nprompt=consent'} rows={3} className="w-full rounded-md bg-muted/40 border border-border/40 text-foreground text-xs font-mono px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
                  </div>
                </div>
              )}

              {providerForm.auth_type === 'apikey' && (
                <div className="pt-1 border-t border-border/30">
                  <label style={S.label}>Field schema (JSON array)</label>
                  <textarea value={providerForm.field_schema_raw} onChange={(e) => setProviderForm((f) => ({ ...f, field_schema_raw: e.target.value }))} placeholder={'[{"name":"api_key","label":"API Key","type":"password"}]'} rows={4} className="w-full rounded-md bg-muted/40 border border-border/40 text-foreground text-xs font-mono px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={closeProviderForm}>Cancel</Button>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white font-bold"
                  disabled={!providerForm.provider.trim() || !providerForm.display_name.trim() || !oauthValid || providerBusy}
                  onClick={() => {
                    const payload = buildProviderPayload();
                    if (editingProviderId) {
                      const { provider: _p, ...rest } = payload;
                      updateProvider.mutate({ id: editingProviderId, data: rest });
                    } else {
                      addProvider.mutate({ agent: providerAgentId!, ...payload });
                    }
                  }}
                >
                  {providerBusy ? (editingProviderId ? 'Saving…' : 'Adding…') : (editingProviderId ? 'Save Changes' : 'Add Provider')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full border-dashed border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/20" onClick={() => setAddProviderOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Integration Provider
            </Button>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => { setProviderAgentId(null); setAddProviderOpen(false); }}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Org Activate / Deactivate ─ */}
      <Dialog open={!!orgActiveDialog} onOpenChange={(o) => !o && setOrgActiveDialog(null)}>
        <DialogContent className="sm:max-w-105 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>{orgActiveDialog?.is_active ? 'Deactivate' : 'Activate'} Organization</DialogTitle>
            <DialogDescription>
              {orgActiveDialog?.is_active
                ? `Deactivating "${orgActiveDialog?.name}" will block all their admins and users immediately.`
                : `Re-activating "${orgActiveDialog?.name}" will restore their access.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOrgActiveDialog(null)}>Cancel</Button>
            <Button
              className={orgActiveDialog?.is_active ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}
              disabled={updateOrgActive.isPending}
              onClick={() => orgActiveDialog && updateOrgActive.mutate({ id: orgActiveDialog.id, is_active: !orgActiveDialog.is_active })}
            >
              {updateOrgActive.isPending ? 'Saving…' : orgActiveDialog?.is_active ? 'Deactivate Org' : 'Activate Org'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Org Agent Kill Switch ─ */}
      <Dialog open={!!toggleOrgAgentDialog} onOpenChange={(o) => !o && setToggleOrgAgentDialog(null)}>
        <DialogContent className="sm:max-w-105 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>{toggleOrgAgentDialog?.current ? 'Disable' : 'Enable'} Agent for Org</DialogTitle>
            <DialogDescription>
              {toggleOrgAgentDialog?.current ? 'Disable' : 'Enable'}{' '}
              <span className="text-primary font-mono">{toggleOrgAgentDialog?.agentName}</span> for{' '}
              <span className="text-yellow-400">{toggleOrgAgentDialog?.orgName}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToggleOrgAgentDialog(null)}>Cancel</Button>
            <Button
              className={toggleOrgAgentDialog?.current ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}
              disabled={toggleOrgAgent.isPending}
              onClick={() => {
                if (!toggleOrgAgentDialog) return;
                toggleOrgAgent.mutate(
                  { orgId: toggleOrgAgentDialog.orgId, agentId: toggleOrgAgentDialog.agentId, data: { is_enabled: !toggleOrgAgentDialog.current } },
                  { onSuccess: () => { setToggleOrgAgentDialog(null); qc.invalidateQueries({ queryKey: ['org-agents', toggleOrgAgentDialog.orgId] }); } }
                );
              }}
            >
              {toggleOrgAgent.isPending ? 'Saving…' : toggleOrgAgentDialog?.current ? 'Disable Agent' : 'Enable Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Change Role ─ */}
      <Dialog open={!!roleDialog} onOpenChange={(o) => !o && setRoleDialog(null)}>
        <DialogContent className="sm:max-w-95 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>{roleDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label style={S.label}>New role</label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                <SelectItem value="superadmin">Superadmin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRoleDialog(null)}>Cancel</Button>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white font-bold" disabled={changeRole.isPending || newRole === roleDialog?.role} onClick={() => changeRole.mutate()}>
              {changeRole.isPending ? 'Saving…' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Lock User ─ */}
      <Dialog open={!!lockDialog} onOpenChange={(o) => !o && setLockDialog(null)}>
        <DialogContent className="sm:max-w-95 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-amber-400">Lock User</DialogTitle>
            <DialogDescription>{lockDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label style={S.label}>Lockout duration (minutes)</label>
            <Input type="number" min={1} value={lockMinutes} onChange={(e) => setLockMinutes(e.target.value)} className="bg-muted/40 border-border/40" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLockDialog(null)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold" disabled={lockUser.isPending || !lockMinutes} onClick={() => lockUser.mutate()}>
              {lockUser.isPending ? 'Locking…' : 'Lock User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Confirm action (unlock / activate / deactivate) ─ */}
      <Dialog open={!!confirmDialog} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-95 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="capitalize">{confirmDialog?.action} User</DialogTitle>
            <DialogDescription>{confirmDialog?.user.email}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button
              className={confirmDialog?.action === 'deactivate' ? 'bg-rose-500 hover:bg-rose-600 text-white' : confirmDialog?.action === 'activate' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-black'}
              disabled={confirmAction.isPending}
              onClick={() => confirmAction.mutate()}
            >
              {confirmAction.isPending ? 'Working…' : `Confirm ${confirmDialog?.action}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Assign Manager ─ */}
      <Dialog open={!!managerDialog} onOpenChange={(o) => !o && setManagerDialog(null)}>
        <DialogContent className="sm:max-w-100 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Assign Manager</DialogTitle>
            <DialogDescription>{managerDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label style={S.label}>Admin manager</label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger className="bg-muted/40 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                <SelectItem value="__none__">— No manager —</SelectItem>
                {(adminsList as ApiUser[]).map((a) => <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManagerDialog(null)}>Cancel</Button>
            <Button className="bg-sky-500 hover:bg-sky-600 text-black font-bold" disabled={assignManager.isPending} onClick={() => assignManager.mutate()}>
              {assignManager.isPending ? 'Saving…' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─ Access Diagnostic ─ */}
      <Dialog open={!!diagnosticUser} onOpenChange={(o) => !o && setDiagnosticUser(null)}>
        <DialogContent className="sm:max-w-145 bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart2 className="h-4 w-4 text-amber-400" /> Access Diagnostic</DialogTitle>
            <DialogDescription>{diagnosticUser?.email}</DialogDescription>
          </DialogHeader>

          {diagLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading diagnostic…</div>
          ) : diagnostic ? (
            <div className="space-y-4 max-h-105 overflow-y-auto py-1">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Total',       value: diagnostic.summary.total_agents,        color: '#00D4FF' },
                  { label: 'Accessible', value: diagnostic.summary.accessible,           color: '#00FF88' },
                  { label: 'Blocked',    value: diagnostic.summary.blocked,              color: '#FF5050' },
                  { label: 'No Access',  value: diagnostic.summary.no_access_granted,   color: '#888' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg bg-muted/20 border border-border/30 p-3 text-center">
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 10, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* User context */}
              <div className="rounded-lg bg-muted/20 border border-border/30 px-4 py-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Active: </span><span className={diagnostic.user.is_active ? 'text-emerald-400' : 'text-rose-400'}>{diagnostic.user.is_active ? 'Yes' : 'No'}</span></div>
                <div><span className="text-muted-foreground">Locked: </span><span className={diagnostic.user.is_locked ? 'text-amber-400' : 'text-emerald-400'}>{diagnostic.user.is_locked ? 'Yes' : 'No'}</span></div>
                {diagnostic.user.managed_by && <div><span className="text-muted-foreground">Manager: </span><span className="text-foreground">{diagnostic.user.managed_by.email}</span></div>}
              </div>

              {/* Per-agent breakdown */}
              <div className="space-y-2">
                {diagnostic.agents.map((ag) => (
                  <div key={ag.agent_id} className="rounded-lg bg-muted/20 border border-border/30 px-4 py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{ag.agent_name}</div>
                      {ag.access_via && <div className="text-[11px] text-muted-foreground">via {ag.access_via}</div>}
                      {ag.block_reasons.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {ag.block_reasons.map((r, i) => <div key={i} className="text-[11px] text-rose-400">{r}</div>)}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 mt-0.5">
                      {ag.has_access
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        : ag.block_reasons.length > 0
                          ? <XCircle className="h-4 w-4 text-rose-400" />
                          : <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter><Button variant="ghost" onClick={() => setDiagnosticUser(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
