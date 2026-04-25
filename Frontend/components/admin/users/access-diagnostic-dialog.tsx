'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAccessDiagnostic } from '@/lib/hooks/use-users';
import { Loader2, ShieldCheck, ShieldAlert, Bot, Layers, Info, CheckCircle2, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface AccessDiagnosticDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessDiagnosticDialog({ userId, open, onOpenChange }: AccessDiagnosticDialogProps) {
  const { data, isLoading, isError } = useAccessDiagnostic(userId || '');

  if (!userId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-[#0A1428] border-border/40 text-foreground shadow-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg ring-1 ring-primary/20">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Access Transparency Diagnostic</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-8">
                Detailed view of permissions and access logic for <span className="text-foreground font-medium">{data?.user.email}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Analyzing permissions graph...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-destructive">
              <ShieldAlert className="h-8 w-8" />
              <p className="text-sm font-medium">Failed to retrieve diagnostic data</p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                {[
                  { label: 'Total Agents', value: data.summary?.total_agents || 0, icon: Bot, color: 'text-primary' },
                  { label: 'Accessible', value: data.summary?.accessible || 0, icon: CheckCircle2, color: 'text-emerald-400' },
                  { label: 'Blocked', value: data.summary?.blocked || 0, icon: XCircle, color: 'text-rose-400' },
                  { label: 'No Access', value: data.summary?.no_access_granted || 0, icon: Info, color: 'text-muted-foreground' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-muted/30 border border-border/20 rounded-xl p-3 text-center">
                    <stat.icon className={`h-4 w-4 mx-auto mb-2 ${stat.color} opacity-80`} />
                    <div className="text-xl font-extrabold">{stat.value}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Status Info */}
              <div className="bg-muted/20 border border-border/20 rounded-xl p-4 flex flex-wrap gap-y-4">
                <div className="w-1/2">
                   <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">User Status</div>
                   <div className="flex items-center gap-2">
                     <Badge variant={data.user?.is_active ? 'default' : 'secondary'} className={data.user?.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}>
                       {data.user?.is_active ? 'Active' : 'Inactive'}
                     </Badge>
                     {data.user?.is_locked && (
                       <Badge variant="destructive" className="bg-rose-500/20 text-rose-400">Locked</Badge>
                     )}
                   </div>
                 </div>
                <div className="w-1/2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Managed By</div>
                  <div className="text-sm font-medium text-primary/80">
                    {data.user.managed_by?.email || 'Standalone Account'}
                  </div>
                </div>
              </div>

              <Separator className="bg-border/20" />

              {/* Agent Access List */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                  <Layers className="h-3 w-3" />
                  <span>Agent Permissions Matrix</span>
                </div>

                <div className="space-y-3">
                  {data.agents.map((agent) => (
                    <div key={agent.agent_id} className="group bg-muted/10 hover:bg-muted/20 border border-border/10 rounded-xl p-4 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("p-1.5 rounded-lg", agent.has_access ? "bg-emerald-500/10" : "bg-muted/40")}>
                            <Bot className={cn("h-4 w-4", agent.has_access ? "text-emerald-400" : "text-muted-foreground/60")} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-foreground/90">{agent.agent_name}</div>
                            <div className="text-[10px] text-muted-foreground/60">
                              ID: {agent.agent_id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                        <Badge 
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-tighter px-2 h-5",
                            agent.has_access ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-muted/40 text-muted-foreground/60"
                          )}
                        >
                          {agent.has_access ? 'Accessible' : 'Access Denied'}
                        </Badge>
                      </div>

                      {/* Access Details */}
                      <div className="pl-9 space-y-2">
                        <div className="flex items-center gap-4 text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-[90px]">
                            <span className="text-muted-foreground/60">Via:</span>
                            <span className="font-semibold text-primary/70 capitalize">{agent.access_via || 'None'}</span>
                          </div>
                          {agent.direct_access?.exists && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground/60">Direct:</span>
                              <Badge variant="outline" className={cn("h-4 text-[9px] px-1.5 border-border/30", agent.direct_access?.is_active ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "text-muted-foreground/40")}>
                                {agent.direct_access?.is_active ? 'Active' : 'Revoked'}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {agent.group_access?.length > 0 && (
                          <div className="flex items-start gap-1.5 text-[11px]">
                            <span className="text-muted-foreground/60 min-w-[90px]">Groups:</span>
                            <div className="flex flex-wrap gap-1">
                              {agent.group_access.map(g => (
                                <Badge key={g.group_id} variant="outline" className={cn("h-4 text-[9px] px-1.5 border-border/30", g.is_active ? "text-primary/70" : "text-muted-foreground/40")}>
                                  {g.group_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {agent.block_reasons?.length > 0 && (
                          <div className="mt-2 bg-rose-500/5 border border-rose-500/20 rounded-lg p-2 space-y-1">
                            {agent.block_reasons.map((reason, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[10px] text-rose-400 font-medium">
                                <XCircle className="h-3 w-3 shrink-0" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
