'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Clock, Bot, ArrowLeft, AlertCircle, TrendingUp, Timer } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { usageApi, type UsageAgentStat } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

export default function UserUsagePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['my-usage'],
    queryFn: usageApi.myStats,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  if (loading || !user) return <LoadingSkeleton />;

  const totalMinutes = stats.reduce((s: number, a: UsageAgentStat) => s + a.minutes_used, 0);
  const blockedCount = stats.filter((a: UsageAgentStat) => a.limit_minutes && a.minutes_used >= a.limit_minutes).length;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
              </Button>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold text-sm">My Usage</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                  {user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* Title */}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">My Usage</h1>
            <p className="text-muted-foreground mt-1 text-sm">Your active chat time across all agents</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-card/60 border-border/40">
              <CardContent className="pt-5 pb-5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                {isLoading ? <Skeleton className="h-7 w-20 mb-1" /> : (
                  <p className="text-2xl font-extrabold tracking-tight">{totalMinutes} min</p>
                )}
                <p className="text-xs text-muted-foreground font-medium mt-1">Total time used</p>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border/40">
              <CardContent className="pt-5 pb-5">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 flex items-center justify-center mb-3">
                  <Bot className="h-5 w-5 text-blue-400" />
                </div>
                {isLoading ? <Skeleton className="h-7 w-20 mb-1" /> : (
                  <p className="text-2xl font-extrabold tracking-tight">{stats.length}</p>
                )}
                <p className="text-xs text-muted-foreground font-medium mt-1">Agents used</p>
              </CardContent>
            </Card>

            <Card className={`border-border/40 ${blockedCount > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-card/60'}`}>
              <CardContent className="pt-5 pb-5">
                <div className={`h-10 w-10 rounded-xl ring-1 flex items-center justify-center mb-3 ${blockedCount > 0 ? 'bg-destructive/10 ring-destructive/20' : 'bg-green-500/10 ring-green-500/20'}`}>
                  {blockedCount > 0
                    ? <AlertCircle className="h-5 w-5 text-destructive" />
                    : <Timer className="h-5 w-5 text-green-400" />
                  }
                </div>
                {isLoading ? <Skeleton className="h-7 w-20 mb-1" /> : (
                  <p className="text-2xl font-extrabold tracking-tight">{blockedCount}</p>
                )}
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  {blockedCount > 0 ? 'Limits reached' : 'No limits reached'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Agent cards */}
          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Agent Breakdown</CardTitle>
              <CardDescription>Minutes used per agent. Limits are set by your admin.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
              ) : stats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-center mb-4">
                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No usage recorded yet</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">Start chatting with an agent to track your time</p>
                  <Button variant="outline" size="sm" asChild className="mt-4">
                    <Link href="/dashboard">Go to Agents</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.map((s: UsageAgentStat) => {
                    const pct = s.limit_minutes ? Math.min(Math.round((s.minutes_used / s.limit_minutes) * 100), 100) : null;
                    const blocked = pct !== null && pct >= 100;
                    const warning = pct !== null && pct >= 75 && !blocked;

                    return (
                      <div
                        key={s.agent_id}
                        className={`p-4 rounded-xl border transition-colors ${
                          blocked
                            ? 'bg-destructive/5 border-destructive/20'
                            : warning
                            ? 'bg-amber-500/5 border-amber-500/20'
                            : 'bg-muted/30 border-border/30'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`h-10 w-10 rounded-xl ring-1 flex items-center justify-center shrink-0 ${
                            blocked ? 'bg-destructive/10 ring-destructive/20'
                            : warning ? 'bg-amber-500/10 ring-amber-500/20'
                            : 'bg-primary/10 ring-primary/20'
                          }`}>
                            <Bot className={`h-5 w-5 ${blocked ? 'text-destructive' : warning ? 'text-amber-400' : 'text-primary'}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-sm">{s.agent_name}</span>
                              <div className="flex items-center gap-2">
                                {blocked && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="destructive" className="text-xs gap-1">
                                        <AlertCircle className="h-3 w-3" /> Blocked
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>You've reached the time limit for this agent</TooltipContent>
                                  </Tooltip>
                                )}
                                {warning && !blocked && (
                                  <Badge className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                                    {pct}% used
                                  </Badge>
                                )}
                                <span className={`text-sm font-bold ${blocked ? 'text-destructive' : 'text-primary'}`}>
                                  {s.minutes_used} min
                                </span>
                              </div>
                            </div>

                            {s.limit_minutes ? (
                              <>
                                <Progress
                                  value={pct ?? 0}
                                  className={`h-1.5 ${blocked ? '[&>div]:bg-destructive' : warning ? '[&>div]:bg-amber-400' : ''}`}
                                />
                                <div className="flex justify-between mt-1">
                                  <span className="text-[11px] text-muted-foreground/60">
                                    {blocked ? 'Limit reached' : `${s.minutes_used} of ${s.limit_minutes} min used`}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground/60">{s.limit_minutes} min max</span>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground/50 mt-0.5">No limit set</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-3 gap-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
