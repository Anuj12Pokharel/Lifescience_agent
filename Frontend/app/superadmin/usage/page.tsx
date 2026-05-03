'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, Bot, Users, Trash2, Plus, ArrowLeft, BarChart3,
  ShieldCheck, TrendingUp, AlertCircle, Timer,
} from 'lucide-react';
import { usageApi, usersApi, agentsApi, type TimeLimit } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

export default function SuperadminUsagePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [limitDialog, setLimitDialog] = useState(false);
  const [limitForm, setLimitForm] = useState({ agent_id: '', target_user_id: '', limit_minutes: '' });

  useEffect(() => {
    if (!loading && (!user || user.role !== 'superadmin')) router.push('/login');
  }, [user, loading, router]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['superadmin-usage'],
    queryFn: usageApi.adminStats,
    enabled: !!user && user.role === 'superadmin',
  });

  const { data: limits = [], isLoading: limitsLoading } = useQuery({
    queryKey: ['usage-limits'],
    queryFn: usageApi.getLimits,
    enabled: !!user && user.role === 'superadmin',
  });

  const { data: adminsData } = useQuery({
    queryKey: ['users', { role: 'admin' }],
    queryFn: () => usersApi.list({ role: 'admin' }),
    enabled: !!user && user.role === 'superadmin',
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(),
    enabled: !!user && user.role === 'superadmin',
  });

  const setLimit = useMutation({
    mutationFn: usageApi.setLimit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usage-limits'] });
      setLimitDialog(false);
      setLimitForm({ agent_id: '', target_user_id: '', limit_minutes: '' });
      toast.success('Time limit set successfully');
    },
    onError: () => toast.error('Failed to set limit'),
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

  if (loading || !user) return <LoadingSkeleton />;

  const admins = adminsData?.results ?? [];
  const agents = agentsData?.results ?? [];
  const byAgent = stats?.by_agent ?? [];
  const byUser = stats?.by_user ?? [];
  const totalMinutes = byAgent.reduce((s, a) => s + a.total_minutes, 0);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                <Link href="/superadmin"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
              </Button>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold text-sm">Platform Usage</span>
              </div>
            </div>
            <Button onClick={() => setLimitDialog(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Set Time Limit
            </Button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Page title */}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Usage Analytics</h1>
            <p className="text-muted-foreground mt-1 text-sm">Monitor agent usage across all admins on the platform</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
              label="Total Platform Minutes"
              value={isLoading ? null : `${totalMinutes} min`}
              sub={`${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`}
              color="bg-primary/10 ring-primary/20"
            />
            <SummaryCard
              icon={<Bot className="h-5 w-5 text-blue-400" />}
              label="Active Agents"
              value={isLoading ? null : String(byAgent.length)}
              sub="agents with usage"
              color="bg-blue-500/10 ring-blue-500/20"
            />
            <SummaryCard
              icon={<ShieldCheck className="h-5 w-5 text-violet-400" />}
              label="Time Limits Set"
              value={isLoading ? null : String(limits.length)}
              sub="admin restrictions"
              color="bg-violet-500/10 ring-violet-500/20"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="by-agent">
            <TabsList className="bg-muted/50 border border-border/40">
              <TabsTrigger value="by-agent" className="gap-2"><Bot className="h-3.5 w-3.5" />By Agent</TabsTrigger>
              <TabsTrigger value="by-admin" className="gap-2"><Users className="h-3.5 w-3.5" />By Admin</TabsTrigger>
              <TabsTrigger value="limits" className="gap-2"><Timer className="h-3.5 w-3.5" />Time Limits</TabsTrigger>
            </TabsList>

            {/* ── By Agent ── */}
            <TabsContent value="by-agent" className="mt-6">
              <Card className="bg-card/60 border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Agent Usage — Platform Total</CardTitle>
                  <CardDescription>Total minutes all admins and their users spent on each agent</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
                  ) : byAgent.length === 0 ? (
                    <EmptyState icon={<Bot className="h-8 w-8" />} message="No agent usage recorded yet" />
                  ) : (
                    <div className="space-y-3">
                      {byAgent.map(a => {
                        const pct = totalMinutes > 0 ? Math.round((a.total_minutes / totalMinutes) * 100) : 0;
                        return (
                          <div key={a.agent_id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                              <Bot className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-sm truncate">{a.agent_name}</span>
                                <span className="text-sm font-bold text-primary ml-4 shrink-0">{a.total_minutes} min</span>
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

            {/* ── By Admin ── */}
            <TabsContent value="by-admin" className="mt-6">
              <Card className="bg-card/60 border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Admin Usage Breakdown</CardTitle>
                  <CardDescription>See how much each admin's users are using each agent</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
                  ) : byUser.length === 0 ? (
                    <EmptyState icon={<Users className="h-8 w-8" />} message="No admin activity recorded yet" />
                  ) : (
                    <div className="rounded-xl border border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="font-semibold">Admin</TableHead>
                            <TableHead className="font-semibold">Agent</TableHead>
                            <TableHead className="text-right font-semibold">Minutes Used</TableHead>
                            <TableHead className="text-right font-semibold">Limit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {byUser.flatMap(u =>
                            u.agents.map((a, i) => (
                              <TableRow key={`${u.user_id}-${a.agent_id}`} className="hover:bg-muted/20">
                                {i === 0 && (
                                  <TableCell rowSpan={u.agents.length} className="align-top pt-4">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-7 w-7">
                                        <AvatarFallback className="text-xs bg-violet-500/20 text-violet-300">
                                          {u.user_email[0].toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-sm font-medium truncate max-w-40">{u.user_email}</span>
                                    </div>
                                  </TableCell>
                                )}
                                <TableCell className="text-sm text-muted-foreground">{a.agent_name}</TableCell>
                                <TableCell className="text-right font-bold text-primary text-sm">{a.minutes_used} min</TableCell>
                                <TableCell className="text-right text-sm">
                                  {a.limit_minutes
                                    ? <Badge variant={a.minutes_used >= a.limit_minutes ? 'destructive' : 'secondary'}>{a.limit_minutes} min</Badge>
                                    : <span className="text-muted-foreground/50">—</span>
                                  }
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Time Limits ── */}
            <TabsContent value="limits" className="mt-6">
              <Card className="bg-card/60 border-border/40">
                <CardHeader className="flex-row items-start justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">Admin Time Limits</CardTitle>
                    <CardDescription className="mt-1">Restrict how many minutes an admin can use each agent</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setLimitDialog(true)} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" /> Set Limit
                  </Button>
                </CardHeader>
                <CardContent>
                  {limitsLoading ? (
                    <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                  ) : limits.length === 0 ? (
                    <EmptyState icon={<Timer className="h-8 w-8" />} message="No time limits set yet" sub="Click 'Set Limit' to restrict an admin's agent usage" />
                  ) : (
                    <div className="rounded-xl border border-border/40 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="font-semibold">Admin</TableHead>
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
                                    <AvatarFallback className="text-xs bg-violet-500/20 text-violet-300">
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
        </main>

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
                  <DialogDescription className="text-xs mt-0.5">Restrict an admin's usage on a specific agent</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSetLimit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Admin</Label>
                <Select value={limitForm.target_user_id} onValueChange={v => setLimitForm(f => ({ ...f, target_user_id: v }))}>
                  <SelectTrigger className="bg-muted/40 border-border/40">
                    <SelectValue placeholder="Select admin…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A1428] border-border/40">
                    {admins.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-violet-500/20 text-violet-300">{a.email[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {a.email}
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
                    {agents.map(a => (
                      <SelectItem key={a.id} value={a.id}>
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
                <p className="text-[11px] text-muted-foreground/60">Admin and all their users will be blocked once this limit is reached</p>
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
      </div>
    </TooltipProvider>
  );
}

function SummaryCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | null; sub: string; color: string }) {
  return (
    <Card className="bg-card/60 border-border/40">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div className={`h-10 w-10 rounded-xl ring-1 flex items-center justify-center ${color}`}>{icon}</div>
          {value === null && <Skeleton className="h-7 w-20" />}
        </div>
        {value !== null && <p className="text-2xl font-extrabold mt-3 tracking-tight">{value}</p>}
        <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
        <p className="text-xs text-muted-foreground/50 mt-0.5">{sub}</p>
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

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
