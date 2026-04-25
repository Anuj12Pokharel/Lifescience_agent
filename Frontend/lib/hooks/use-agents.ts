import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agentsApi, type ListAgentsParams, type CreateAgentPayload } from '@/lib/api-client';

// ─── Query keys ────────────────────────────────────────────────────────────────

export const agentKeys = {
  all: ['agents'] as const,
  list: (params: ListAgentsParams) => ['agents', 'list', params] as const,
  detail: (slug: string) => ['agents', 'detail', slug] as const,
  myAgents: () => ['agents', 'my-agents'] as const,
  publicList: (params: ListAgentsParams) => ['agents', 'public', params] as const,
  access: (slug: string, page: number) => ['agents', 'access', slug, page] as const,
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export function useAgents(params: ListAgentsParams = {}, enabled = true) {
  return useQuery({
    queryKey: agentKeys.list(params),
    queryFn: () => agentsApi.list(params),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export function usePublicAgents(params: ListAgentsParams = {}) {
  return useQuery({
    queryKey: agentKeys.publicList(params),
    queryFn: () => agentsApi.publicList(params),
    staleTime: 30_000,
  });
}

export function useMyAgents() {
  return useQuery({
    queryKey: agentKeys.myAgents(),
    queryFn: agentsApi.myAgents,
  });
}

export function useAdminMyAgents() {
  return useQuery({
    queryKey: ['agents', 'admin-my-agents'] as const,
    queryFn: agentsApi.adminMyAgents,
  });
}

export function useAgent(slug: string) {
  return useQuery({
    queryKey: agentKeys.detail(slug),
    queryFn: () => agentsApi.get(slug),
    enabled: Boolean(slug),
  });
}

export function useAgentAccess(slug: string, page: number) {
  return useQuery({
    queryKey: agentKeys.access(slug, page),
    queryFn: () => agentsApi.listAccess(slug, page),
    enabled: Boolean(slug),
    placeholderData: (prev) => prev,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAgentPayload) => agentsApi.create(payload),
    onSuccess: () => {
      toast.success('Agent created');
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to create agent');
    },
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: Partial<CreateAgentPayload> }) =>
      agentsApi.update(slug, payload),
    onSuccess: (_, { slug }) => {
      toast.success('Agent updated');
      qc.invalidateQueries({ queryKey: agentKeys.all });
      qc.invalidateQueries({ queryKey: agentKeys.detail(slug) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to update agent');
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => agentsApi.delete(slug),
    onSuccess: () => {
      toast.success('Agent deleted');
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to delete agent');
    },
  });
}

export function useToggleAgentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => agentsApi.toggleStatus(slug),
    onSuccess: (data, slug) => {
      toast.success(`Agent ${data.is_active ? 'activated' : 'deactivated'}`);
      qc.invalidateQueries({ queryKey: agentKeys.all });
      qc.invalidateQueries({ queryKey: agentKeys.detail(slug) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to toggle status');
    },
  });
}

export function useGrantAgentAccess(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: string; expires_at?: string | null }) =>
      agentsApi.grantAccess(slug, payload),
    onSuccess: () => {
      toast.success('Access granted');
      qc.invalidateQueries({ queryKey: ['agents', 'access', slug] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to grant access');
    },
  });
}

export function useRevokeAgentAccess(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => agentsApi.revokeAccess(slug, userId),
    onSuccess: () => {
      toast.success('Access revoked');
      qc.invalidateQueries({ queryKey: ['agents', 'access', slug] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to revoke access');
    },
  });
}
