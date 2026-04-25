import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { groupsApi, type ListGroupsParams, type CreateGroupPayload } from '@/lib/api-client';

// ─── Query keys ────────────────────────────────────────────────────────────────

export const groupKeys = {
  all: ['groups'] as const,
  list: (params: ListGroupsParams) => ['groups', 'list', params] as const,
  detail: (id: string) => ['groups', 'detail', id] as const,
  myGroups: () => ['groups', 'my-groups'] as const,
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export function useGroups(params: ListGroupsParams = {}) {
  return useQuery({
    queryKey: groupKeys.list(params),
    queryFn: () => groupsApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useMyGroups() {
  return useQuery({
    queryKey: groupKeys.myGroups(),
    queryFn: groupsApi.myGroups,
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: () => groupsApi.get(id),
    enabled: Boolean(id),
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => groupsApi.create(payload),
    onSuccess: () => {
      toast.success('Group created');
      qc.invalidateQueries({ queryKey: groupKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to create group');
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateGroupPayload> }) =>
      groupsApi.update(id, payload),
    onSuccess: (_, { id }) => {
      toast.success('Group updated');
      qc.invalidateQueries({ queryKey: groupKeys.all });
      qc.invalidateQueries({ queryKey: groupKeys.detail(id) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to update group');
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => groupsApi.delete(id),
    onSuccess: () => {
      toast.success('Group deleted');
      qc.invalidateQueries({ queryKey: groupKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to delete group');
    },
  });
}

export function useToggleGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => groupsApi.toggle(id),
    onSuccess: (data, id) => {
      toast.success(data.message || `Group ${data.is_active ? 'activated' : 'deactivated'}`);
      qc.invalidateQueries({ queryKey: groupKeys.all });
      qc.invalidateQueries({ queryKey: groupKeys.detail(id) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to toggle group');
    },
  });
}

export function useAddGroupMembers(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user_ids: string[]) => groupsApi.addMembers(groupId, user_ids),
    onSuccess: (data) => {
      toast.success(`${data.added} member(s) added`);
      qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to add members');
    },
  });
}

export function useRemoveGroupMember(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(groupId, userId),
    onSuccess: () => {
      toast.success('Member removed');
      qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to remove member');
    },
  });
}

export function useAssignGroupAgents(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agent_ids: string[]) => groupsApi.assignAgents(groupId, agent_ids),
    onSuccess: (data) => {
      toast.success(`${data.added} agent(s) assigned`);
      qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to assign agents');
    },
  });
}

export function useRemoveGroupAgent(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => groupsApi.removeAgent(groupId, agentId),
    onSuccess: () => {
      toast.success('Agent removed from group');
      qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to remove agent');
    },
  });
}
