'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bot, Lock, Plug, Users, AlertTriangle, CheckCircle2, Plus,
  ExternalLink, Search, Loader2
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

  const availableMembers = (agentId: string) =>
    members.filter(
      (m: OrgMember) => !permissions.some((p) => p.user === m.user_id && p.agent === agentId)
    );

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white italic uppercase">AI <span className="text-cyan-400">Agents</span></h1>
            <p className="text-sm md:text-base text-slate-400 max-w-xl">
              Configure specialized intelligence units, manage their external integrations, and distribute access across your organization.
            </p>
          </div>
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 bg-white/5 border-white/10 text-white h-12 rounded-2xl focus:ring-cyan-500/20 focus:border-cyan-500/30 transition-all duration-300"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-64 rounded-3xl bg-white/5 border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 rounded-3xl bg-white/[0.02] border border-dashed border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
              <Bot className="h-8 w-8 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium">{search ? 'No agents match your search' : 'No agents found for your organization'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      <Dialog open={!!grantAgent} onOpenChange={(o) => !o && setGrantAgent(null)}>
        <DialogContent className="sm:max-w-[420px] bg-slate-900 border-white/10 text-white p-0 overflow-hidden rounded-2xl">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Grant Agent Access</DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-1">
                Authorize <span className="text-white font-bold">{grantAgent?.name}</span> for a team member.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Member</label>
                <Select value={grantUserId} onValueChange={setGrantUserId}>
                  <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-cyan-500/20">
                    <SelectValue placeholder="Choose a member..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    {availableMembers(grantAgent?.id ?? '').map((m: OrgMember) => (
                      <SelectItem key={m.user_id} value={m.user_id} className="focus:bg-white/5">{m.user_email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {grantAgent && availableMembers(grantAgent.id).length === 0 && (
                  <p className="text-[10px] text-amber-400 font-medium">All members already have access to this agent.</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white/[0.02] p-6 flex justify-end gap-3 border-t border-white/5 mt-2">
            <Button variant="ghost" onClick={() => setGrantAgent(null)} className="hover:bg-white/5 text-slate-400">Cancel</Button>
            <Button
              className="bg-cyan-500 text-black font-black hover:bg-cyan-400 min-w-[120px] rounded-xl shadow-lg shadow-cyan-500/20"
              disabled={!grantUserId || grantPerm.isPending}
              onClick={() => {
                if (!grantAgent || !grantUserId) return;
                grantPerm.mutate(
                  { user_id: grantUserId, agent_id: grantAgent.id },
                  { onSuccess: () => { setGrantAgent(null); setGrantUserId(''); } }
                );
              }}
            >
              {grantPerm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Access'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function AgentCard({ agent, onGrantAccess }: { agent: OrgAgent; onGrantAccess: () => void }) {
  const blocked = agent.is_blocked_by_superadmin;

  return (
    <div className={`group relative rounded-3xl border bg-white/[0.02] backdrop-blur-md flex flex-col p-6 transition-all duration-500 ${
      blocked
        ? 'border-rose-500/10 opacity-50 grayscale pointer-events-none'
        : 'border-white/5 hover:bg-white/[0.05] hover:border-cyan-500/20 hover:shadow-2xl hover:shadow-cyan-500/5'
    }`}>
      <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-[0.05] transition-all duration-700 -rotate-12 translate-x-4 -translate-y-4 pointer-events-none">
        <Bot className="h-32 w-32 text-cyan-400" />
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
          blocked 
            ? 'bg-slate-900 border-white/5' 
            : 'bg-cyan-500/10 border-cyan-500/20 shadow-lg shadow-cyan-500/10 group-hover:scale-110 group-hover:rotate-3'
        }`}>
          <Bot className={`h-7 w-7 ${blocked ? 'text-slate-600' : 'text-cyan-400'}`} />
        </div>
        
        {blocked ? (
           <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] font-black uppercase tracking-widest px-2 py-0.5">Blocked</Badge>
        ) : (
          <div className="flex flex-col items-end gap-1">
             <Badge className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${
                agent.status === 'live' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
             }`}>
               {agent.status}
             </Badge>
          </div>
        )}
      </div>

      <div className="space-y-1 mb-6 relative">
        <h3 className="text-xl font-black text-white tracking-tight group-hover:text-cyan-400 transition-colors">{agent.name}</h3>
        <p className="text-sm text-slate-400 leading-relaxed font-medium line-clamp-2">{agent.subtitle || 'General purpose AI assistant'}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-slate-300">
           <Users className="h-3 w-3 text-cyan-400" />
           {agent.users_with_access} {agent.users_with_access === 1 ? 'Member' : 'Members'}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold ${
          agent.integration_connected 
            ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' 
            : 'bg-amber-500/5 border-amber-500/10 text-amber-400'
        }`}>
           {agent.integration_connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
           {agent.integration_connected ? 'Sync Connected' : 'No Integration'}
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-white/5 flex gap-3">
        {!agent.integration_connected ? (
          <Button asChild variant="ghost" className="flex-1 h-10 rounded-xl bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 text-xs font-bold border border-amber-500/10">
            <Link href="/admin/integrations">
              <Plug className="h-3.5 w-3.5 mr-2" /> Connect
            </Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" className="flex-1 h-10 rounded-xl bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold border border-emerald-500/10">
            <Link href="/admin/integrations">
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> Tools
            </Link>
          </Button>
        )}

        <Button
          onClick={onGrantAccess}
          className="flex-1 h-10 rounded-xl bg-white text-black font-black hover:bg-cyan-400 hover:text-black text-xs transition-all shadow-lg hover:shadow-cyan-500/20"
        >
          <Plus className="h-3.5 w-3.5 mr-2" />
          Assign
        </Button>
      </div>
    </div>
  );
}
