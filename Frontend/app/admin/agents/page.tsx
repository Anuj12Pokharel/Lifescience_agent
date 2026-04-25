'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bot, Lock, Plug, Users, AlertTriangle, CheckCircle2, Plus,
  ExternalLink, Search
} from 'lucide-react';
import { useOrgAgents } from '@/lib/hooks/use-organizations';
import { useAgentPermissions, useGrantAgentPermission, useOrgMembers } from '@/lib/hooks/use-organizations';
import { type OrgAgent, type OrgMember } from '@/lib/api-client';
import DashboardLayout from '@/components/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function AdminAgentsPage() {
  const { data: agents = [], isLoading } = useOrgAgents();
  const { data: members = [] } = useOrgMembers();
  const { data: permissions = [] } = useAgentPermissions();
  const grantPerm = useGrantAgentPermission();

  const [search, setSearch] = useState('');
  const [grantAgent, setGrantAgent] = useState<OrgAgent | null>(null);
  const [grantUserId, setGrantUserId] = useState('');

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.subtitle ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // Members who don't already have access to a given agent
  const availableMembers = (agentId: string) =>
    members.filter(
      (m: OrgMember) => !permissions.some((p) => p.user === m.user_id && p.agent === agentId)
    );

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">AI Agents</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All agents available to your organization. Connect integrations and grant user access.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/40 border-border/40"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-muted/20 border border-border/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
            <Bot className="h-10 w-10 opacity-20" />
            <p>{search ? 'No agents match your search' : 'No agents found for your organization'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onGrantAccess={() => { setGrantAgent(agent); setGrantUserId(''); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Grant Access Dialog */}
      <Dialog open={!!grantAgent} onOpenChange={(o) => !o && setGrantAgent(null)}>
        <DialogContent className="sm:max-w-[420px] bg-[#0A1428] border-border/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Grant Access</DialogTitle>
            <DialogDescription>
              Give a member access to <span className="text-primary font-semibold">{grantAgent?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-2 block">Member</label>
            <Select value={grantUserId} onValueChange={setGrantUserId}>
              <SelectTrigger className="bg-muted/40 border-border/40">
                <SelectValue placeholder="Select member..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                {availableMembers(grantAgent?.id ?? '').map((m: OrgMember) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.user_email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {grantAgent && availableMembers(grantAgent.id).length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">All members already have access to this agent.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGrantAgent(null)}>Cancel</Button>
            <Button
              className="bg-primary text-black font-bold"
              disabled={!grantUserId || grantPerm.isPending}
              onClick={() => {
                if (!grantAgent || !grantUserId) return;
                grantPerm.mutate(
                  { user_id: grantUserId, agent_id: grantAgent.id },
                  { onSuccess: () => { setGrantAgent(null); setGrantUserId(''); } }
                );
              }}
            >
              {grantPerm.isPending ? 'Granting...' : 'Grant Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function AgentCard({ agent, onGrantAccess }: { agent: OrgAgent; onGrantAccess: () => void }) {
  const blocked = agent.is_blocked_by_superadmin;

  return (
    <div className={`relative rounded-2xl border bg-card/20 backdrop-blur-sm flex flex-col gap-4 p-6 transition-all duration-200 ${
      blocked
        ? 'border-rose-500/20 opacity-60 cursor-not-allowed'
        : 'border-border/40 hover:bg-card/30 hover:border-border/60'
    }`}>
      {/* Blocked overlay badge */}
      {blocked && (
        <div className="absolute top-3 right-3">
          <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10 text-[10px] gap-1">
            <Lock className="h-3 w-3" /> Disabled by superadmin
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 shrink-0 ${
          blocked ? 'bg-muted/20 ring-muted/30' : 'bg-primary/10 ring-primary/20'
        }`}>
          <Bot className={`h-5 w-5 ${blocked ? 'text-muted-foreground' : 'text-primary'}`} />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-foreground leading-tight">{agent.name}</div>
          {agent.subtitle && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{agent.subtitle}</div>
          )}
        </div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap gap-2">
        {agent.status && (
          <Badge variant="outline" className={`text-[10px] ${
            agent.status === 'live'
              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/8'
              : 'border-amber-500/30 text-amber-400 bg-amber-500/8'
          }`}>
            ● {agent.status.toUpperCase()}
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] border-muted-foreground/20 text-muted-foreground capitalize">
          {agent.agent_type}
        </Badge>
        <Badge variant="outline" className={`text-[10px] gap-1 ${
          agent.integration_connected
            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/8'
            : 'border-amber-500/30 text-amber-400 bg-amber-500/8'
        }`}>
          {agent.integration_connected
            ? <><CheckCircle2 className="h-2.5 w-2.5" /> Integration connected</>
            : <><AlertTriangle className="h-2.5 w-2.5" /> No integration</>
          }
        </Badge>
      </div>

      {/* Users with access */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>
          {agent.users_with_access === 0
            ? 'No users have access'
            : `${agent.users_with_access} user${agent.users_with_access !== 1 ? 's' : ''} with access`}
        </span>
      </div>

      {/* Actions */}
      {!blocked && (
        <div className="flex gap-2 mt-auto pt-2 border-t border-border/20">
          {!agent.integration_connected ? (
            <Link href="/admin/integrations" className="flex-1">
              <Button variant="outline" size="sm" className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs h-8">
                <Plug className="h-3.5 w-3.5 mr-1.5" /> Connect a tool
              </Button>
            </Link>
          ) : (
            <Link href="/admin/integrations" className="flex-1">
              <Button variant="outline" size="sm" className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs h-8">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Manage integration
              </Button>
            </Link>
          )}

          <Button
            size="sm"
            className="flex-1 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-xs h-8"
            onClick={onGrantAccess}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {agent.users_with_access === 0 ? 'Grant access' : 'Add user'}
          </Button>
        </div>
      )}
    </div>
  );
}
