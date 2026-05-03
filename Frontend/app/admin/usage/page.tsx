'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, Bot, Users, Trash2, Plus, BarChart3, Timer,
  TrendingUp, ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';
import { usageApi, usersApi, agentsApi, type TimeLimit } from '@/lib/api-client';
import DashboardLayout from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

export default function AdminUsagePage() {
  const qc = useQueryClient();
  const [limitDialog, setLimitDialog] = useState(false);
  const [limitForm, setLimitForm] = useState({ agent_id: '', target_user_id: '', limit_minutes: '' });
  const [openUsers, setOpenUsers] = useState<Set<string>>(new Set());

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: usageApi.adminStats,
  });

  const { data: limits = [], isLoading: limitsLoading } = useQuery({
    queryKey: ['usage-limits'],
    queryFn: usageApi.getLimits,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', { role: 'user' }],
    queryFn: () => usersApi.list({ role: 'user' }),
  });

  const { data: agentsData } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: agentsApi.adminMyAgents,
  });

  const setLimit = useMutation({
    mutationFn: usageApi.setLimit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usage-limits'] });
      setLimitDialog(false);
      setLimitForm({ agent_id: '', target_user_id: '', limit_minutes: '' });
      toast.success('Time limit saved');
    },
    onError: () => toast.error('Failed to save limit'),
  });

  const deleteLimit = useMutation({
    mutationFn: usageApi.deleteLimit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usage-limits'] });
      toast.success('Limit removed');
    },
  });

  const handleSetLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitForm.agent_id || !limitForm.target_user_id || !limitForm.limit_minutes) return;
    setLimit.mutate({
      agent_id: limitForm.agent_id,
      target_user_id: limitForm.target_user_id,
      limit_minutes: parseInt(limitForm.limit_minutes),
    });
  };

  const toggleUser = (id: string) => {
    setOpenUsers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const users = usersData?.results ?? [];
  const agents = agentsData ?? [];
  const byAgent = stats?.by_agent ?? [];
  const byUser = stats?.by_user ?? [];
  const totalMinutes = byAgent.reduce((s, a) => s + a.total_minutes, 0);

  return (
    <TooltipProvider>
      <DashboardLayout requireAdmin>
        <div className="space-y-8 max-w-5xl mx-auto py-2">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Usage Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-sm">Agent usage across your users</p>
            </div>
            <Button onClick={() => setLimitDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Set Time Limit
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
              label="Total Minutes"
              value={isLoading ? null : `${totalMinutes} min`}
              color="bg-primary/10 ring-primary/20"
            />
            <SummaryCard
              icon={<Bot className="h-5 w-5 text-blue-400" />}
              label="Agents Used"
              value={isLoading ? null : String(byAgent.length)}
              color="bg-blue-500/10 ring-blue-500/20"
            />
            <SummaryCard
              icon={<Timer className="h-5 w-5 text-amber-400" />}
              label="Limits Active"
              value={isLoading ? null : String(limits.length)}
              color="bg-amber-500/10 ring-amber-500/20"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="by-agent">
            <TabsList className="bg-muted/50 border border-border/40">
              <TabsTrigger value="by-agent" className="gap-2"><BarChart3 className="h-3.5 w-3.5" />By Agent</TabsTrigger>
              <TabsTrigger value="by-user" className="gap-2"><Users className="h-3.5 w-3.5" />By User</TabsTrigger>
              <TabsTrigger value="limits" className="gap-2 relative">
                <Timer className="h-3.5 w-3.5" />Limits
                {limits.length > 0 && (
                  <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">{limits.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── By Agent ── */}
            <TabsContent value="by-agent" className="mt-6">
              <Card className="bg-card/60 border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Per Agent — Total Minutes</CardTitle>
                  <CardDescription>Combined usage across all your users per agent</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
                  ) : byAgent.length === 0 ? (
                    <EmptyState icon={<Bot className="h-8 w-8" />} message="No agent usage yet" />
                  ) : (
                    <div className="space-y-3">
                      {byAgent.map(a => {
                        const pct = totalMinutes > 0 ? Math.round((a.total_minutes / totalMinutes) * 100) : 0;
                        return (
                          <div key={a.agent_id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                              <Bot className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-sm">{a.agent_name}</span>
                                <span className="text-sm font-bold text-primary">{a.total_minutes} min</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">{pct}%</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── By User ── */}
            <TabsContent value="by-user" className="mt-6">
              <Card className="bg-card/60 border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Per User Breakdown</CardTitle>
                  <CardDescription>Expand each user to see their per-agent usage</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                  ) : byUser.length === 0 ? (
                    <EmptyState icon={<Users className="h-8 w-8" />} message="No user activity yet" />
                  ) : (
                    <div className="space-y-2">
                      {byUser.map(u => {
                        const userTotal = u.agents.reduce((s, a) => s + a.minutes_used, 0);
                        const isOpen = openUsers.has(u.user_id);
                        return (
                          <Collapsible key={u.user_id} open={isOpen} onOpenChange={() => toggleUser(u.user_id)}>
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors cursor-pointer">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                      {u.user_email[0].toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="text-left">
                                    <p className="text-sm font-semibold">{u.user_email}</p>
                                    <p className="text-xs text-muted-foreground">{u.agents.length} agent{u.agents.length !== 1 ? 's' : ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 font-bold">
                                    {userTotal} min total
                                  </Badge>
                                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-1 ml-4 pl-4 border-l-2 border-border/30 space-y-1.5 pb-1">
                                {u.agents.map(a => {
                                  const pct = a.limit_minutes ? Math.min(Math.round((a.minutes_used / a.limit_minutes) * 100), 100) : null;
                                  const blocked = pct !== null && pct >= 100;
                                  return (
                                    <div key={a.agent_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                                      <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="text-sm flex-1">{a.agent_name}</span>
                                      <span className="text-sm font-bold text-primary">{a.minutes_used} min</span>
                                      {a.limit_minutes && (
                                        <Badge variant={blocked ? 'destructive' : 'secondary'} className="text-xs">
                                          {blocked && <AlertCircle className="h-3 w-3 mr-1" />}
                                          / {a.limit_minutes} max
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Limits ── */}
            <TabsContent value="limits" className="mt-6">
              <Card className="bg-card/60 border-border/40">
                <CardHeader className="flex-row items-start justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">User Time Limits</CardTitle>
                    <CardDescription className="mt-1">Users are blocked once their limit is reached</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setLimitDialog(true)} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" /> Set Limit
                  </Button>
                </CardHeader>
                <CardContent>
                  {limitsLoading ? (
                    <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                  ) : limits.length === 0 ? (
                    <EmptyState icon={<Timer className="h-8 w-8" />} message="No limits set" sub="Click 'Set Limit' to restrict a user's agent usage" />
                  ) : (
                    <div className="rounded-xl border border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="font-semibold">User</TableHead>
                            <TableHead className="font-semibold">Agent</TableHead>
                            <TableHead className="text-right font-semibold">Limit</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(limits as TimeLimit[]).map(lim => (
                            <TableRow key={lim.id} className="hover:bg-muted/20">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                      {lim.target_user_email[0].toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{lim.target_user_email}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">{lim.agent_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10 font-bold">
                                  {lim.limit_minutes} min
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => deleteLimit.mutate(lim.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove limit</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Set Limit Dialog */}
        <Dialog open={limitDialog} onOpenChange={setLimitDialog}>
          <DialogContent className="sm:max-w-md bg-[#0A1428] border-border/40">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center justify-center">
                  <Timer className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">Set Time Limit</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">Restrict a user's usage on a specific agent</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSetLimit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">User</Label>
                <Select value={limitForm.target_user_id} onValueChange={v => setLimitForm(f => ({ ...f, target_user_id: v }))}>
                  <SelectTrigger className="bg-muted/40 border-border/40">
                    <SelectValue placeholder="Select user…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40">
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{u.email[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {u.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Agent</Label>
                <Select value={limitForm.agent_id} onValueChange={v => setLimitForm(f => ({ ...f, agent_id: v }))}>
                  <SelectTrigger className="bg-muted/40 border-border/40">
                    <SelectValue placeholder="Select agent…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40">
                    {agents.map((a: any) => (
                      <SelectItem key={a.id || a.agent_id} value={a.id || a.agent_id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-3.5 w-3.5 text-primary" />{a.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Max Minutes</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    type="number" min="1" placeholder="e.g. 60"
                    className="pl-9 bg-muted/40 border-border/40"
                    value={limitForm.limit_minutes}
                    onChange={e => setLimitForm(f => ({ ...f, limit_minutes: e.target.value }))}
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/60">User will be blocked from this agent once the limit is reached</p>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setLimitDialog(false)} className="text-muted-foreground">Cancel</Button>
                <Button type="submit" disabled={setLimit.isPending} className="min-w-24">
                  {setLimit.isPending ? 'Saving…' : 'Set Limit'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </TooltipProvider>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | null; color: string }) {
  return (
    <Card className="bg-card/60 border-border/40">
      <CardContent className="pt-5 pb-5">
        <div className={`h-10 w-10 rounded-xl ring-1 flex items-center justify-center mb-3 ${color}`}>{icon}</div>
        {value === null ? <Skeleton className="h-7 w-20 mb-1" /> : <p className="text-2xl font-extrabold tracking-tight">{value}</p>}
        <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-muted-foreground/20 mb-3">{icon}</div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {sub && <p className="text-xs text-muted-foreground/50 mt-1">{sub}</p>}
    </div>
  );
}
