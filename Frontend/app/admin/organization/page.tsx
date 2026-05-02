'use client';

import { useState } from 'react';
import { Building2, Users, Bot, Plus, Trash2, Edit2, Check, X, Mail } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-layout';
import { useMyOrg, useUpdateMyOrg, useOrgMembers, useAgentPermissions, useGrantAgentPermission, useRevokeAgentPermission, useOrgAgents, useSubscribeAgent, useUnsubscribeAgent } from '@/lib/hooks/use-organizations';
import { useGmailStatus, useConnectGmail, useDisconnectGmail } from '@/lib/hooks/use-integrations';
import { organizationsApi, type OrgMember, type AgentPermission, type OrgAgent } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminOrganizationPage() {
  // My Org
  const { data: org, isLoading: orgLoading } = useMyOrg();
  const updateOrg = useUpdateMyOrg();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  // Members
  const { data: members = [], isLoading: membersLoading } = useOrgMembers();

  // Agent Permissions
  const { data: permissions = [], isLoading: permsLoading } = useAgentPermissions();
  const grantPerm = useGrantAgentPermission();
  const revokePerm = useRevokeAgentPermission();

  // All org agents — subscribed and available — from single endpoint
  const { data: allOrgAgents = [], isLoading: subscribedLoading } = useOrgAgents();
  const subscribeMutation = useSubscribeAgent();
  const unsubscribeMutation = useUnsubscribeAgent();

  const subscribedAgents = allOrgAgents.filter((a: OrgAgent) => a.is_subscribed);
  const availableAgents  = allOrgAgents.filter((a: OrgAgent) => !a.is_subscribed);

  // agents alias used by Grant Access dialog select
  const agents = subscribedAgents;

  const [grantDialog, setGrantDialog] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantAgentId, setGrantAgentId] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);

  // Gmail Integration
  const { data: gmailStatus, isLoading: gmailLoading } = useGmailStatus();
  const connectGmail = useConnectGmail();
  const disconnectGmail = useDisconnectGmail();

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">My Organization</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your organization, members, and agent access grants.</p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-muted/30 border border-border/40">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Building2 className="h-4 w-4 mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="h-4 w-4 mr-2" /> Members
            </TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Bot className="h-4 w-4 mr-2" /> Subscribed Agents
            </TabsTrigger>
            <TabsTrigger value="permissions" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Bot className="h-4 w-4 mr-2" /> Agent Permissions
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-6">
            {orgLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : !org ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">Organization not found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-card/20 border-border/40 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Organization Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Name</label>
                      {editingName ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-muted/40 border-border/40 h-8 text-sm"
                          />
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                            onClick={() => { updateOrg.mutate({ name: newName }); setEditingName(false); }}>
                            <Check className="h-4 w-4 text-emerald-400" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingName(false)}>
                            <X className="h-4 w-4 text-rose-400" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-foreground font-semibold">{org.name}</span>
                          <button onClick={() => { setNewName(org.name); setEditingName(true); }}
                            className="text-muted-foreground hover:text-primary transition-colors">
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Owner</label>
                      <p className="text-sm text-foreground mt-1">{org.owner_email}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Slug</label>
                      <p className="text-sm font-mono text-primary mt-1">{org.slug}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</label>
                      <div className="mt-1">
                        <Badge variant="outline" className={org.is_active ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-rose-500/30 text-rose-500 bg-rose-500/10"}>
                          {org.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/20 border-border/40 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Plan & Usage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Plan</span>
                      <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">{org.plan.display_name}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Members</span>
                      <span className="text-sm font-semibold text-foreground">{org.member_count} / {org.plan.max_users || '∞'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Max Agents</span>
                      <span className="text-sm font-semibold text-foreground">{org.plan.max_agents || '∞'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Price</span>
                      <span className="text-sm font-semibold text-foreground">${org.plan.price_usd_monthly}/mo</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Gmail Integration Card */}
                <Card className="bg-card/20 border-border/40 backdrop-blur-sm md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Invitation Sender (Gmail OAuth)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-1 max-w-xl">
                        <p className="text-sm text-foreground font-medium">
                          Connect your company Gmail account to send member invitations from your own email address.
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          By default, invitations are sent via our system SMTP. Connecting your Gmail provides a more professional experience for your team members.
                        </p>
                      </div>

                      <div className="shrink-0">
                        {gmailLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : gmailStatus?.connected ? (
                          <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase font-bold text-emerald-500/70 tracking-tight">Connected as</span>
                              <span className="text-sm font-semibold text-foreground">{gmailStatus.gmail_email}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8"
                              onClick={() => disconnectGmail.mutate()}
                              disabled={disconnectGmail.isPending}
                            >
                              {disconnectGmail.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Disconnect'}
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            className="bg-white text-black hover:bg-white/90 font-bold"
                            onClick={() => connectGmail.mutate()}
                            disabled={connectGmail.isPending}
                          >
                            {connectGmail.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                            Connect Company Gmail
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>


          {/* Members */}
          <TabsContent value="members" className="mt-6">
            <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden backdrop-blur-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Email</TableHead>
                    <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Status</TableHead>
                    <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <TableRow key={i} className="border-border/20">
                        <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded-full" /></TableCell>
                        <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      </TableRow>
                    ))
                  ) : members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 opacity-20" />
                          <p>No members yet</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m: OrgMember) => (
                      <TableRow key={m.id} className="border-border/20 hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs ring-1 ring-primary/20">
                              {m.user_email[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-foreground">{m.user_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={m.is_active ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-rose-500/30 text-rose-500 bg-rose-500/10"}>
                            {m.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.joined_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Subscribed Agents */}
          <TabsContent value="agents" className="mt-6">
            <div className="space-y-6">
              {/* Currently subscribed */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Subscribed Agents</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Agents your organization currently has access to.</p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">{subscribedAgents.length} active</Badge>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Agent</TableHead>
                        <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Type</TableHead>
                        <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Source</TableHead>
                        <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Status</TableHead>
                        <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Users</TableHead>
                        <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscribedLoading ? (
                        Array(3).fill(0).map((_, i) => (
                          <TableRow key={i} className="border-border/20">
                            <TableCell><div className="h-4 w-40 bg-muted animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-5 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                            <TableCell><div className="h-5 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                            <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded-full" /></TableCell>
                            <TableCell><div className="h-4 w-10 bg-muted animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-20 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : subscribedAgents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                              <Bot className="h-8 w-8 opacity-20" />
                              <p>No agents subscribed yet</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        subscribedAgents.map((a: OrgAgent) => {
                          const isSuperadminGrant = a.subscription_type === 'superadmin';
                          return (
                            <TableRow key={a.id} className="border-border/20 hover:bg-white/5">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Bot className="h-4 w-4 text-primary" />
                                  <div>
                                    <div className="font-medium text-foreground text-sm">{a.name}</div>
                                    {a.subtitle && <div className="text-xs text-muted-foreground">{a.subtitle}</div>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-border/40 text-muted-foreground text-xs">{a.agent_type}</Badge>
                              </TableCell>
                              <TableCell>
                                {isSuperadminGrant ? (
                                  <Badge variant="outline" className="border-violet-500/30 text-violet-400 bg-violet-500/10 text-xs">Superadmin</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-sky-500/30 text-sky-400 bg-sky-500/10 text-xs">Self</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {a.is_blocked_by_superadmin ? (
                                  <Badge variant="outline" className="border-rose-500/30 text-rose-500 bg-rose-500/10 text-xs">Blocked</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 text-xs">Active</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{a.users_with_access}</TableCell>
                              <TableCell className="text-right">
                                {isSuperadminGrant ? (
                                  <span className="text-xs text-muted-foreground italic">Managed by superadmin</span>
                                ) : (
                                  <Button
                                    variant="ghost" size="sm"
                                    className="h-7 px-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-semibold"
                                    disabled={unsubscribeMutation.isPending}
                                    onClick={() => unsubscribeMutation.mutate(a.id)}
                                  >
                                    {unsubscribeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                                    Unsubscribe
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Available to subscribe */}
              {availableAgents.length > 0 && (
                <div>
                  <div className="mb-3">
                    <h3 className="font-semibold text-foreground">Available Agents</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Subscribe your org to gain access to these agents.</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden backdrop-blur-sm">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Agent</TableHead>
                          <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Type</TableHead>
                          <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableAgents.map((a: OrgAgent) => (
                          <TableRow key={a.id} className="border-border/20 hover:bg-white/5">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium text-foreground text-sm">{a.name}</div>
                                  {a.subtitle && <div className="text-xs text-muted-foreground">{a.subtitle}</div>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-border/40 text-muted-foreground text-xs">{a.agent_type}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {a.can_subscribe === false ? (
                                <span className="text-xs text-muted-foreground italic">Plan limit reached</span>
                              ) : (
                              <Button
                                size="sm"
                                className="h-7 px-3 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 text-xs font-semibold"
                                disabled={subscribeMutation.isPending}
                                onClick={() => subscribeMutation.mutate(a.id)}
                              >
                                {subscribeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                                Subscribe
                              </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Agent Permissions */}
          <TabsContent value="permissions" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">Grant members access to specific agents.</p>
              <Button onClick={() => setGrantDialog(true)} className="bg-primary text-black font-bold shadow-[0_0_20px_-5px_rgba(var(--primary),0.4)]">
                <Plus className="mr-2 h-4 w-4" /> Grant Access
              </Button>
            </div>

            <div className="rounded-xl border border-border/40 bg-card/20 overflow-hidden backdrop-blur-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">User</TableHead>
                    <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Agent</TableHead>
                    <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Status</TableHead>
                    <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground">Granted</TableHead>
                    <TableHead className="font-bold tracking-wider text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permsLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <TableRow key={i} className="border-border/20">
                        <TableCell><div className="h-4 w-40 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded-full" /></TableCell>
                        <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : permissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Bot className="h-8 w-8 opacity-20" />
                          <p>No agent permissions granted yet</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    permissions.map((p: AgentPermission) => (
                      <TableRow key={p.id} className="border-border/20 hover:bg-white/5">
                        <TableCell className="font-medium text-foreground">{p.user_email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                            <span className="text-sm">{p.agent_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.is_active ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-rose-500/30 text-rose-500 bg-rose-500/10"}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            onClick={() => setRevokeId(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Grant Dialog */}
      <Dialog open={grantDialog} onOpenChange={setGrantDialog}>
        <DialogContent className="sm:max-w-[420px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Grant Agent Access</DialogTitle>
            <DialogDescription>Select a member and an agent to grant access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">Member</label>
              <Select value={grantUserId} onValueChange={setGrantUserId}>
                <SelectTrigger className="bg-muted/40 border-border/40">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                  {members.map((m: OrgMember) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.user_email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">Agent</label>
              <Select value={grantAgentId} onValueChange={setGrantAgentId}>
                <SelectTrigger className="bg-muted/40 border-border/40">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGrantDialog(false)}>Cancel</Button>
            <Button
              className="bg-primary text-black font-bold"
              disabled={!grantUserId || !grantAgentId || grantPerm.isPending}
              onClick={() => {
                grantPerm.mutate(
                  { user_id: grantUserId, agent_id: grantAgentId },
                  { onSuccess: () => { setGrantDialog(false); setGrantUserId(''); setGrantAgentId(''); } }
                );
              }}
            >
              {grantPerm.isPending ? 'Granting...' : 'Grant Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm */}
      <Dialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-rose-500">Revoke Access</DialogTitle>
            <DialogDescription>This will remove the agent access grant. The user will no longer have access.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={revokePerm.isPending}
              onClick={() => { if (revokeId) revokePerm.mutate(revokeId, { onSuccess: () => setRevokeId(null) }); }}>
              {revokePerm.isPending ? 'Revoking...' : 'Revoke Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
