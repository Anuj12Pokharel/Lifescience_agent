'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAgentAccess, useGrantAgentAccess, useRevokeAgentAccess } from '@/lib/hooks/use-agents';
import { Loader2, Users, Calendar, ShieldCheck, Plus, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AgentAccessManagementDialogProps {
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentAccessManagementDialog({ slug, open, onOpenChange }: AgentAccessManagementDialogProps) {
  const [page, setPage] = useState(1);
  const [showGrant, setShowGrant] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const { data, isLoading } = useAgentAccess(slug, page);
  const accesses = data?.results ?? [];
  const pagination = data ? {
    count: data.count,
    next: data.next,
    previous: data.previous,
    total_pages: Math.ceil(data.count / 10) // Assuming 10 items per page
  } : null;

  const revokeAccess = useRevokeAgentAccess(slug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-[#0A1428] border-border/40 text-foreground shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/20 bg-muted/10">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Agent Access Control
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Currently managing direct access to <span className="text-primary font-mono">{slug}</span>.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col min-h-[400px]">
          <div className="px-6 py-4 flex justify-between items-center bg-card/20 border-b border-border/10">
            <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Direct User Grants
            </h3>
            <Button 
              size="sm" 
              onClick={() => setShowGrant(!showGrant)}
              variant={showGrant ? 'secondary' : 'default'}
              className={!showGrant ? "bg-primary text-black font-bold h-8" : "h-8"}
            >
              {showGrant ? 'Cancel Grant' : <><Plus className="mr-1 h-3.5 w-3.5" /> Grant Access</>}
            </Button>
          </div>

          {showGrant && (
            <div className="px-6 py-4 border-b border-border/10 bg-primary/5">
              <GrantAccessForm slug={slug} onSuccess={() => setShowGrant(false)} />
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-6">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : accesses.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border border-dashed border-border/40 rounded-xl bg-muted/5">
                  <span className="block p-3 rounded-full bg-muted/20 mb-3"><Users className="h-6 w-6 opacity-40 text-primary" /></span>
                  <p className="text-sm font-medium">No direct access records found</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[200px]">Users might still have access via group memberships.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accesses.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-border/20 bg-card/20 hover:bg-muted/10 transition-colors group">
                      <div>
                        <p className="font-semibold text-sm text-foreground mb-0.5">{a.user?.email}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground/80 font-mono">{a.user?.id.substring(0,8)}</span>
                          {a.expires_at && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                              <Calendar className="h-3 w-3" />
                              Expires {new Date(a.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className={`h-6 text-[10px] uppercase tracking-wider ${a.is_active ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
                          {a.is_active ? 'Active' : 'Revoked'}
                        </Badge>
                        {a.is_active && (
                          confirmRevokeId === a.user?.id ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:bg-muted"
                                onClick={() => setConfirmRevokeId(null)}
                              >
                                Cancel
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className="h-7 text-[10px] uppercase font-bold"
                                disabled={revokeAccess.isPending}
                                onClick={() => { 
                                  if (a.user) revokeAccess.mutate(a.user.id); 
                                  setConfirmRevokeId(null); 
                                }}
                              >
                                {revokeAccess.isPending && confirmRevokeId === a.user?.id ? '...' : 'Confirm'}
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-7 w-7 p-0 opacity-100 transition-opacity border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                              onClick={() => setConfirmRevokeId(a.user?.id || null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {pagination && pagination.total_pages > 1 && (
            <div className="p-3 border-t border-border/20 flex justify-between items-center bg-muted/10">
              <Button 
               variant="outline" size="sm" 
               disabled={page <= 1}
               onClick={() => setPage(page - 1)}
               className="bg-transparent border-border/40 h-7 text-[10px] uppercase font-bold"
              >
                Prev
              </Button>
              <span className="text-[10px] text-muted-foreground font-bold tracking-widest">{page} / {pagination.total_pages}</span>
              <Button 
               variant="outline" size="sm" 
               disabled={page >= pagination.total_pages}
               onClick={() => setPage(page + 1)}
               className="bg-transparent border-border/40 h-7 text-[10px] uppercase font-bold"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GrantAccessForm({ slug, onSuccess }: { slug: string, onSuccess: () => void }) {
  const [userId, setUserId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const grantAccess = useGrantAgentAccess(slug);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    const payload: { user_id: string; expires_at?: string | null } = { user_id: userId.trim() };
    if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();
    
    grantAccess.mutate(payload, { onSuccess });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end animate-in fade-in slide-in-from-top-2">
      <div className="flex-1 space-y-2">
        <label className="text-[10px] font-bold text-primary/80 uppercase tracking-widest">User ID</label>
        <Input 
          value={userId} 
          onChange={(e) => setUserId(e.target.value)} 
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" 
          className="bg-[#0A1428] border-border/40 h-9"
          required
        />
      </div>
      <div className="flex-1 space-y-2">
        <label className="text-[10px] font-bold text-primary/80 uppercase tracking-widest flex items-center gap-1">
          <Calendar className="h-3 w-3" /> Expiration Date <span className="text-muted-foreground/50">(optional)</span>
        </label>
        <Input 
          type="datetime-local" 
          value={expiresAt} 
          onChange={(e) => setExpiresAt(e.target.value)} 
          className="bg-[#0A1428] border-border/40 text-xs h-9 [color-scheme:dark]"
        />
      </div>
      <Button 
        type="submit" 
        disabled={grantAccess.isPending || !userId.trim()} 
        className="h-9 font-bold bg-primary text-black hover:bg-primary/90"
      >
        {grantAccess.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Grant'}
      </Button>
    </form>
  );
}
