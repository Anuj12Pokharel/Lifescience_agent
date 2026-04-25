'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plug, Key, Trash2, ExternalLink, Bot, CheckCircle, AlertCircle,
  Plus, Loader2, Hash, RefreshCw
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import {
  useIntegrationProviders, useGetOAuthUrl, useConnectApiKey,
  useIntegrationCredentials, useDisconnectIntegration, useUpdateMessengerConfig,
} from '@/lib/hooks/use-integrations';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi, type IntegrationProvider, type IntegrationCredential } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// Providers that need extra config after OAuth
const MESSENGER_PROVIDERS = ['slack'];

export default function AdminIntegrationsPage() {
  const qc = useQueryClient();

  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');

  const { data: agentsData } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => agentsApi.list(),
    select: (d) => d.results ?? [],
  });
  const agents = agentsData ?? [];

  const { data: providers = [], isLoading: providersLoading } = useIntegrationProviders(
    selectedAgentId === 'all' ? undefined : selectedAgentId
  );
  const { data: credentials = [], isLoading: credsLoading } = useIntegrationCredentials();

  const connectApiKey = useConnectApiKey();
  const disconnect = useDisconnectIntegration();
  const updateMessengerConfig = useUpdateMessengerConfig();

  // ── API key dialog ────────────────────────────────────────────────────────
  const [apiKeyDialog, setApiKeyDialog] = useState<IntegrationProvider | null>(null);
  const [apiKeyFields, setApiKeyFields] = useState<Record<string, string>>({});

  // ── OAuth popup flow ──────────────────────────────────────────────────────
  const [oauthConnecting, setOauthConnecting] = useState<string | null>(null); // providerId
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // After OAuth → Slack channel config
  const [slackConfigDialog, setSlackConfigDialog] = useState<{ agentSlug: string } | null>(null);
  const [slackChannel, setSlackChannel] = useState('');

  // ── Disconnect confirm ────────────────────────────────────────────────────
  const [disconnectId, setDisconnectId] = useState<string | null>(null);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Start polling credentials after popup opens
  const startPolling = useCallback((providerId: string, providerSlug: string, agentSlug?: string) => {
    const prevCount = credentials.filter((c) => c.provider_slug === providerSlug).length;

    pollRef.current = setInterval(async () => {
      // If popup closed without connecting, bail out
      if (popupRef.current?.closed) {
        stopPolling();
        setOauthConnecting(null);
        return;
      }

      // Refetch credentials
      await qc.invalidateQueries({ queryKey: ['integrations', 'credentials'] });
      const fresh = qc.getQueryData<IntegrationCredential[]>(['integrations', 'credentials']) ?? [];
      const newCred = fresh.find(
        (c) => c.provider_slug === providerSlug &&
          fresh.filter((x) => x.provider_slug === providerSlug).length > prevCount
      );

      if (newCred) {
        stopPolling();
        setOauthConnecting(null);
        popupRef.current?.close();
        toast.success(`${newCred.provider_name} connected!`);

        // If it's a messenger-type provider (e.g. Slack), ask for channel config
        if (MESSENGER_PROVIDERS.includes(providerSlug) && agentSlug) {
          setSlackChannel('');
          setSlackConfigDialog({ agentSlug });
        }
      }
    }, 2500);
  }, [credentials, qc, stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleOAuthConnect = useCallback(async (provider: IntegrationProvider) => {
    setOauthConnecting(provider.id);
    try {
      // Step 2: get auth URL from backend
      const res = await agentsApi.list(); // keep TS happy – actual call below
      void res;
    } catch { /* noop */ }

    // We call the API via the hook's mutateAsync
    // but useGetOAuthUrl is a mutation — inline call here instead for simplicity
    const { default: api } = await import('@/lib/api');
    try {
      const resp = await api.get(`/api/v1/integrations/${provider.id}/connect/`);
      const authUrl: string = resp.data?.data?.auth_url ?? resp.data?.auth_url;
      if (!authUrl) throw new Error('No auth_url returned');

      // Step 3: open popup
      const popup = window.open(
        authUrl,
        'oauth_popup',
        'width=600,height=720,left=200,top=100,toolbar=0,scrollbars=1'
      );
      popupRef.current = popup;

      if (!popup) {
        toast.error('Popup blocked. Please allow popups for this site.');
        setOauthConnecting(null);
        return;
      }

      // Resolve agent slug for messenger config
      const agentEntry = agents.find((a: any) => a.id === provider.agent);
      startPolling(provider.id, provider.provider, agentEntry?.slug);
    } catch (err) {
      toast.error('Failed to initiate connection');
      setOauthConnecting(null);
    }
  }, [agents, startPolling]);

  const handleApiKeySubmit = () => {
    if (!apiKeyDialog) return;
    connectApiKey.mutate(
      { provider_id: apiKeyDialog.id, credentials: apiKeyFields },
      { onSuccess: () => { setApiKeyDialog(null); setApiKeyFields({}); } }
    );
  };

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect tools and services to your AI agents.</p>
        </div>

        <Tabs defaultValue="connect">
          <TabsList className="bg-muted/30 border border-border/40">
            <TabsTrigger value="connect" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Plus className="h-4 w-4 mr-2" /> Connect Tool
            </TabsTrigger>
            <TabsTrigger value="connected" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Plug className="h-4 w-4 mr-2" /> Connected ({credentials.length})
            </TabsTrigger>
          </TabsList>

          {/* ── Step 1: Browse providers ───────────────────────────────────── */}
          <TabsContent value="connect" className="mt-6">
            <div className="mb-6">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">
                Filter by Agent
              </label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="bg-muted/40 border-border/40 w-64">
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {providersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-44 rounded-xl bg-muted/20 border border-border/40 animate-pulse" />
                ))}
              </div>
            ) : providers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
                <Plug className="h-10 w-10 opacity-20" />
                <p>No providers available{selectedAgentId !== 'all' ? ' for this agent' : ''}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map((provider: IntegrationProvider) => {
                  const alreadyConnected = credentials.some(
                    (c) => c.provider_slug === provider.provider && c.agent_name === provider.agent_name
                  );
                  const isConnecting = oauthConnecting === provider.id;

                  return (
                    <Card key={provider.id} className="bg-card/20 border-border/40 backdrop-blur-sm hover:bg-card/30 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {provider.logo_url ? (
                              <img src={provider.logo_url} alt={provider.display_name} className="w-8 h-8 rounded-lg object-contain" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Plug className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-foreground">{provider.display_name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Bot className="h-3 w-3" /> {provider.agent_name}
                              </div>
                            </div>
                          </div>
                          {alreadyConnected && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5 mb-4">
                          {provider.auth_type === 'oauth2' ? 'OAuth 2.0' : 'API Key'}
                        </Badge>

                        {/* Step 2 / connect button */}
                        {provider.auth_type === 'oauth2' ? (
                          <Button
                            className="w-full bg-primary text-black font-bold text-sm h-9"
                            disabled={isConnecting}
                            onClick={() => handleOAuthConnect(provider)}
                          >
                            {isConnecting ? (
                              <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Waiting for auth…</>
                            ) : (
                              <><ExternalLink className="h-3.5 w-3.5 mr-2" />
                                {alreadyConnected ? `Reconnect ${provider.display_name}` : `Connect ${provider.display_name}`}
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full border-border/40 text-foreground text-sm h-9 hover:bg-muted/40"
                            onClick={() => { setApiKeyDialog(provider); setApiKeyFields({}); }}
                          >
                            <Key className="h-3.5 w-3.5 mr-2" />
                            {alreadyConnected ? 'Update API Key' : 'Enter API Key'}
                          </Button>
                        )}

                        {/* Waiting hint */}
                        {isConnecting && (
                          <p className="text-[11px] text-muted-foreground text-center mt-2">
                            Complete the authorization in the popup window
                          </p>
                        )}

                        {/* Slack: set channel button — visible once connected */}
                        {alreadyConnected && MESSENGER_PROVIDERS.includes(provider.provider) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 border-primary/30 text-primary hover:bg-primary/10 text-xs h-8"
                            onClick={() => {
                              const agentEntry = agents.find((a: any) => a.id === provider.agent);
                              setSlackChannel('');
                              setSlackConfigDialog({ agentSlug: agentEntry?.slug ?? provider.agent_name });
                            }}
                          >
                            <Hash className="h-3.5 w-3.5 mr-1.5" /> Set default Slack channel
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Step 5: Connected integrations ────────────────────────────── */}
          <TabsContent value="connected" className="mt-6">
            {credsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-32 rounded-xl bg-muted/20 border border-border/40 animate-pulse" />
                ))}
              </div>
            ) : credentials.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
                <Plug className="h-10 w-10 opacity-20" />
                <p>No integrations connected yet</p>
                <p className="text-xs opacity-60">Go to &quot;Connect Tool&quot; to add your first integration</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {credentials.map((cred: IntegrationCredential) => (
                  <div key={cred.id} className="rounded-xl bg-card/20 border border-border/40 p-5 backdrop-blur-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Plug className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{cred.provider_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Bot className="h-3 w-3" /> {cred.agent_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cred.is_expired ? (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10 text-[10px]">
                            <AlertCircle className="h-3 w-3 mr-1" /> Expired
                          </Badge>
                        ) : cred.is_active ? (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 text-[10px]">
                            <CheckCircle className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-rose-500/30 text-rose-500 bg-rose-500/10 text-[10px]">Inactive</Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 mb-4">
                      <div>Connected by: <span className="text-foreground font-medium">{cred.connected_by_email}</span></div>
                      {cred.token_expiry && (
                        <div>Expires: <span className="text-foreground font-medium">{new Date(cred.token_expiry).toLocaleDateString()}</span></div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {/* Slack: re-configure channel */}
                      {cred.provider_slug === 'slack' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary hover:bg-primary/10 h-8 px-3"
                          onClick={() => {
                            setSlackChannel('');
                            setSlackConfigDialog({ agentSlug: cred.agent_name });
                          }}
                        >
                          <Hash className="h-3.5 w-3.5 mr-2" /> Set Channel
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 px-3"
                        onClick={() => setDisconnectId(cred.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Disconnect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── API Key Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!apiKeyDialog} onOpenChange={(o) => !o && setApiKeyDialog(null)}>
        <DialogContent className="sm:max-w-[440px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Connect {apiKeyDialog?.display_name}</DialogTitle>
            <DialogDescription>Enter your API credentials to connect this integration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {apiKeyDialog?.field_schema.map((field) => (
              <div key={field.name}>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">
                  {field.label}
                </label>
                <Input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={apiKeyFields[field.name] ?? ''}
                  onChange={(e) => setApiKeyFields((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={`Enter ${field.label.toLowerCase()}…`}
                  className="bg-muted/40 border-border/40"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApiKeyDialog(null)}>Cancel</Button>
            <Button
              className="bg-primary text-black font-bold"
              disabled={
                connectApiKey.isPending ||
                !apiKeyDialog?.field_schema.every((f) => apiKeyFields[f.name]?.trim())
              }
              onClick={handleApiKeySubmit}
            >
              {connectApiKey.isPending ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Step 4: Slack channel config ──────────────────────────────────── */}
      <Dialog
        open={!!slackConfigDialog}
        onOpenChange={(o) => { if (!o && !updateMessengerConfig.isPending) setSlackConfigDialog(null); }}
      >
        <DialogContent className="sm:max-w-[440px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" /> Set default Slack channel
            </DialogTitle>
            <DialogDescription>
              Choose which channel the agent should post to. Enter the channel ID (e.g.{' '}
              <span className="font-mono text-foreground">C0XXXXXXX</span>) — found in Slack under channel details.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">
              Channel ID
            </label>
            <Input
              value={slackChannel}
              onChange={(e) => setSlackChannel(e.target.value.trim())}
              placeholder="C0XXXXXXX"
              className="bg-muted/40 border-border/40 font-mono"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              You can find this by opening the channel in Slack → About → Copy channel ID.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSlackConfigDialog(null)}
              disabled={updateMessengerConfig.isPending}
            >
              Skip for now
            </Button>
            <Button
              className="bg-primary text-black font-bold"
              disabled={!slackChannel || updateMessengerConfig.isPending}
              onClick={() => {
                if (!slackConfigDialog) return;
                updateMessengerConfig.mutate(
                  {
                    agent_slug: slackConfigDialog.agentSlug,
                    default_channel: slackChannel,
                    messenger: 'slack',
                  },
                  { onSuccess: () => setSlackConfigDialog(null) }
                );
              }}
            >
              {updateMessengerConfig.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Saving…</>
              ) : (
                'Save Channel'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Disconnect confirm ─────────────────────────────────────────────── */}
      <Dialog open={!!disconnectId} onOpenChange={(o) => !o && setDisconnectId(null)}>
        <DialogContent className="sm:max-w-[380px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-rose-500">Disconnect Integration</DialogTitle>
            <DialogDescription>
              This permanently removes the stored credentials. The agent will lose access until reconnected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisconnectId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={() => {
                if (disconnectId) disconnect.mutate(disconnectId, { onSuccess: () => setDisconnectId(null) });
              }}
            >
              {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
