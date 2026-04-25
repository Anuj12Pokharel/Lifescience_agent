'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateAgent, useUpdateAgent } from '@/lib/hooks/use-agents';
import { Agent, CreateAgentPayload } from '@/lib/api-client';
import { Loader2, Bot } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface AgentFormDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentFormDialog({ agent, open, onOpenChange }: AgentFormDialogProps) {
  const { user } = useAuth();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  
  const [form, setForm] = useState({
    name: agent?.name ?? '',
    subtitle: agent?.subtitle ?? '',
    description: agent?.description ?? '',
    status: agent?.status ?? ('live' as 'live' | 'offline' | 'maintenance'),
    latency: agent?.latency ?? 'instant',
    efficiency: agent?.efficiency ?? 100,
    agent_type: agent?.agent_type ?? ('custom' as Agent['agent_type']),
    config: agent?.config ? JSON.stringify(agent.config, null, 2) : '{\n  \n}',
    is_active: agent?.is_active ?? true,
  });
  const [configError, setConfigError] = useState('');

  const isPending = createAgent.isPending || updateAgent.isPending;
  const error: string =
    (createAgent.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ??
    (updateAgent.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? '';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setConfigError('');

    // Prevent creation of new agents by non-superadmin users
    if (!agent && user?.role !== 'superadmin') {
      return;
    }

    const basePayload: CreateAgentPayload = {
      name: form.name,
      ...(form.subtitle && { subtitle: form.subtitle }),
      ...(form.description && { description: form.description }),
      status: form.status,
      latency: form.latency,
      efficiency: form.efficiency,
    };

    if (agent) {
      let parsedConfig: Record<string, unknown> = {};
      if (form.config.trim()) {
        try { parsedConfig = JSON.parse(form.config); }
        catch { setConfigError('Invalid JSON format for Configuration'); return; }
      }

      updateAgent.mutate({
        slug: agent.slug,
        payload: { ...basePayload, agent_type: form.agent_type, config: parsedConfig, is_active: form.is_active },
      }, { onSuccess: () => onOpenChange(false) });
    } else {
      createAgent.mutate(basePayload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-[#0A1428] border-border/40 text-foreground shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg ring-1 ring-primary/20">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">{agent ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mr-8">
                {agent ? 'Update configuration and parameters for ' + agent.name : 'Define a new AI agent for the platform.'}
              </DialogDescription>
              {!agent && user?.role !== 'superadmin' && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs rounded-md p-2 mt-2">
                  Only superadmins can create new agents.
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md p-3 mb-4">{error}</div>}
        {configError && <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm rounded-md p-3 mb-4">{configError}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Name</label>
            <Input 
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
              placeholder="e.g. Sales Assistant" 
              className="bg-muted/40 border-border/40" 
              required 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Subtitle / Role Description</label>
            <Input 
              value={form.subtitle} 
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })} 
              placeholder="e.g. Handles initial customer inquiries" 
              className="bg-muted/40 border-border/40" 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Detailed Description</label>
            <Textarea 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              placeholder="Full description of agent capabilities..." 
              className="bg-muted/40 border-border/40 min-h-[80px]" 
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Status</label>
              <Select value={form.status} onValueChange={(val: any) => setForm({ ...form, status: val })}>
                <SelectTrigger className="bg-muted/40 border-border/40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#0A1428] border-border/40 text-foreground">
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Latency</label>
              <Input 
                value={form.latency} 
                onChange={(e) => setForm({ ...form, latency: e.target.value as 'instant' | 'fast' | 'moderate' | 'slow' })} 
                placeholder="instant, 2s" 
                className="bg-muted/40 border-border/40" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Efficiency %</label>
              <Input 
                type="number" 
                min={0} max={100} 
                value={form.efficiency} 
                onChange={(e) => setForm({ ...form, efficiency: Math.min(100, Math.max(0, Number(e.target.value))) })} 
                className="bg-muted/40 border-border/40" 
              />
            </div>
          </div>

          {agent && (
            <div className="space-y-2 mt-4 pt-4 border-t border-border/20">
              <label className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-2 flex items-center justify-between">
                <span>Advanced Configuration</span>
                <span className="text-muted-foreground/50 font-mono lowercase tracking-normal bg-muted/50 px-2 py-0.5 rounded">JSON formatting</span>
              </label>
              <Textarea 
                value={form.config} 
                onChange={(e) => setForm({ ...form, config: e.target.value })} 
                className="bg-[#020B18]/50 border-border/40 min-h-[150px] font-mono text-xs" 
                placeholder="{}"
              />
            </div>
          )}

          <DialogFooter className="pt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button 
              type="submit" 
              disabled={isPending || (!agent && user?.role !== 'superadmin')} 
              className="bg-primary text-black font-bold min-w-32 shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]"
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isPending ? 'Saving...' : agent ? 'Update Agent' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
