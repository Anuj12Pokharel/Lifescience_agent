'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUserAgents, useToggleUserAgentAccess, useGrantUserAgentAccess, useUserGroups } from '@/lib/hooks/use-users';
import { Loader2, Bot, Plus, X, Calendar, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ApiUser, UserAgentAccess } from '@/lib/api-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAgents } from '@/lib/hooks/use-agents';

interface AgentAccessDialogProps {
  user: ApiUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentAccessDialog({ user, open, onOpenChange }: AgentAccessDialogProps) {
  const [activeTab, setActiveTab] = useState('agents');
  const [showGrant, setShowGrant] = useState(false);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-[#0A1428] border-border/40 text-foreground shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/20 bg-muted/10">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Access & Groups
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Managing agent permissions for <span className="text-primary font-medium">{user.email}</span>.
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-[400px]">
          <div className="px-6 pt-2">
            <TabsList className="grid w-full grid-cols-2 bg-muted/40 border-border/40">
              <TabsTrigger value="agents" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none">Agent Access</TabsTrigger>
              <TabsTrigger value="groups" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none">Group Memberships</TabsTrigger>
            </TabsList>
            
            {activeTab === 'agents' && !showGrant && (
               <div className="mt-4 mb-2 flex justify-end">
                 <Button onClick={() => setShowGrant(true)} size="sm" className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-none h-8">
                   <Plus className="mr-2 h-3.5 w-3.5" /> Grant Access
                 </Button>
               </div>
            )}
            
            {showGrant && activeTab === 'agents' && (
              <GrantAccessForm userId={user.id} onCancel={() => setShowGrant(false)} />
            )}
          </div>

          <ScrollArea className="flex-1">
             <div className="p-6 pt-2 h-full">
                <TabsContent value="agents" className="m-0 h-full">
                  {!showGrant && <AgentList user={user} />}
                </TabsContent>
                <TabsContent value="groups" className="m-0 h-full">
                  <GroupList user={user} />
                </TabsContent>
             </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AgentList({ user }: { user: ApiUser }) {
  const { data, isLoading } = useUserAgents(user.id);
  const toggle = useToggleUserAgentAccess(user.id);
  const agents = data?.agents ?? [];

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border border-dashed border-border/40 rounded-xl bg-muted/10">
        <Bot className="h-8 w-8 mb-2 opacity-50 text-primary" />
        <p className="text-sm">No agent access granted yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {agents.map((agent) => {
        const isPending = toggle.isPending && toggle.variables === agent.agent_id;
        const isActive = agent.has_access && agent.access_is_active && !agent.access_is_expired;
        
        let badgeColor = "bg-muted text-muted-foreground";
        let badgeLabel = "No Access";
        if (agent.access_is_expired) { badgeColor = "bg-amber-500/20 text-amber-500 border-amber-500/30"; badgeLabel = "Expired"; }
        else if (isActive) { badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; badgeLabel = "Active"; }
        else if (agent.has_access) { badgeColor = "bg-rose-500/20 text-rose-400 border-rose-500/30"; badgeLabel = "Revoked"; }

        return (
          <div key={agent.agent_id} className="flex items-center justify-between p-3 rounded-lg border border-border/20 bg-card/20 hover:bg-muted/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">{agent.name}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/80">
                  <span className="uppercase tracking-wider">{agent.agent_type}</span>
                  {agent.expires_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(agent.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${badgeColor}`}>
                {badgeLabel}
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                disabled={!agent.agent_is_active || isPending}
                onClick={() => toggle.mutate(agent.agent_id)}
                className={`h-7 px-3 text-[10px] font-bold tracking-wider uppercase bg-transparent ${isActive ? "text-rose-400 border-rose-500/30 hover:bg-rose-500/10" : "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"}`}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : (isActive ? 'Revoke' : 'Activate')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupList({ user }: { user: ApiUser }) {
  const { data: groups, isLoading } = useUserGroups(user.id);

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border border-dashed border-border/40 rounded-xl bg-muted/10">
        <Search className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Not a member of any groups.</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Manage memberships from the Group details page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-4">
      {groups.map((g) => (
        <div key={g.id} className="flex flex-col p-3 rounded-lg border border-border/20 bg-card/20">
          <div className="flex justify-between items-center w-full">
            <span className="font-semibold text-sm text-foreground">{g.name}</span>
            <Badge variant="outline" className={`h-5 px-1.5 text-[9px] uppercase tracking-wider ${g.is_active ? 'text-primary border-primary/30 bg-primary/10' : 'text-muted-foreground bg-muted'}`}>
              {g.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground/40 italic text-center mt-4">Group memberships must be managed from the Groups tab directly.</p>
    </div>
  );
}

function GrantAccessForm({ userId, onCancel }: { userId: string, onCancel: () => void }) {
  const [agentId, setAgentId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const grant = useGrantUserAgentAccess(userId);
  const { data } = useAgents({ is_active: true, page_size: 100 });
  const allAgents = data?.results ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) return;
    grant.mutate(
      { agent_id: agentId, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null },
      { onSuccess: onCancel }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="border border-primary/20 bg-primary/5 rounded-xl p-4 mb-4 mt-2 animate-in fade-in slide-in-from-top-2">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Grant New Access</h4>
        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={onCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Select Agent</label>
          <Select value={agentId} onValueChange={setAgentId} required>
            <SelectTrigger className="bg-[#0A1428] border-border/40 h-9">
              <SelectValue placeholder="Choose an active agent..." />
            </SelectTrigger>
            <SelectContent className="bg-[#0A1428] border-border/40 text-foreground max-h-48">
              {allAgents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
              {allAgents.length === 0 && <SelectItem value="none" disabled>No active agents available</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Expiration Date (Optional)</label>
          <Input 
            type="datetime-local" 
            value={expiresAt} 
            onChange={(e) => setExpiresAt(e.target.value)} 
            className="bg-[#0A1428] border-border/40 text-xs h-9"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button 
            type="submit" 
            disabled={grant.isPending || !agentId} 
            size="sm"
            className="h-8 text-xs font-bold w-full bg-primary text-black hover:bg-primary/90"
          >
            {grant.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : 'Confirm Grant'}
          </Button>
        </div>
      </div>
    </form>
  );
}
