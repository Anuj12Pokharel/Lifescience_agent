import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { organizationsApi } from '@/lib/api-client';

const KEYS = {
  myOrg: ['org', 'me'] as const,
  members: ['org', 'members'] as const,
  agents: ['org', 'agents'] as const,
  permissions: ['org', 'agent-permissions'] as const,
  allOrgs: ['org', 'all'] as const,
};

export function useMyOrg() {
  return useQuery({
    queryKey: KEYS.myOrg,
    queryFn: organizationsApi.getMyOrg,
  });
}

export function useUpdateMyOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organizationsApi.updateMyOrg,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.myOrg });
      toast.success('Organization updated');
    },
  });
}

export function useOrgAgents() {
  return useQuery({
    queryKey: KEYS.agents,
    queryFn: organizationsApi.listAgents,
  });
}

export function useOrgMembers() {
  return useQuery({
    queryKey: KEYS.members,
    queryFn: organizationsApi.listMembers,
  });
}

export function useAgentPermissions() {
  return useQuery({
    queryKey: KEYS.permissions,
    queryFn: organizationsApi.listAgentPermissions,
  });
}

export function useGrantAgentPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organizationsApi.grantAgentPermission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.permissions });
      toast.success('Agent access granted');
    },
  });
}

export function useRevokeAgentPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organizationsApi.revokeAgentPermission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.permissions });
      toast.success('Agent access revoked');
    },
  });
}

export function useAllOrgs() {
  return useQuery({
    queryKey: KEYS.allOrgs,
    queryFn: organizationsApi.listAll,
  });
}

export function useToggleOrgAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, agentId, data }: { orgId: string; agentId: string; data: { is_enabled: boolean; notes?: string } }) =>
      organizationsApi.toggleOrgAgent(orgId, agentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.allOrgs });
      toast.success('Agent status updated');
    },
  });
}

export function useSubscribeAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => organizationsApi.subscribeAgent(agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.agents });
      toast.success('Subscribed to agent');
    },
    onError: () => toast.error('Failed to subscribe'),
  });
}

export function useUnsubscribeAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => organizationsApi.unsubscribeAgent(agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.agents });
      toast.success('Unsubscribed from agent');
    },
    onError: () => toast.error('Failed to unsubscribe'),
  });
}
