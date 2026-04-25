import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersApi, type ListUsersParams } from '@/lib/api-client';


// ─── Query keys ────────────────────────────────────────────────────────────────

export const userKeys = {
  all: ['users'] as const,
  list: (params: ListUsersParams) => ['users', 'list', params] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  agents: (id: string) => ['users', 'agents', id] as const,
  groups: (id: string) => ['users', 'groups', id] as const,
  diagnostic: (id: string) => ['users', 'diagnostic', id] as const,
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export function useUsers(params: ListUsersParams = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersApi.get(id),
    enabled: Boolean(id),
  });
}

export function useAccessDiagnostic(id: string) {
  return useQuery({
    queryKey: userKeys.diagnostic(id),
    queryFn: () => usersApi.accessDiagnostic(id),
    enabled: Boolean(id),
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password?: string; password_confirm?: string; managed_by_id?: string }) =>
      usersApi.invite(data),
    onSuccess: (res) => {
      toast.success(res.message || 'User invited successfully');
      qc.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to invite user');
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      usersApi.updateRole(id, role),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to update role');
    },
  });
}

export function useAssignManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, managed_by_id }: { id: string; managed_by_id: string | null }) =>
      usersApi.assignManager(id, managed_by_id),
    onSuccess: (res) => {
      toast.success(res.message || 'Manager assigned');
      qc.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to assign manager');
    },
  });
}

export function useAssignCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, company_id }: { id: string; company_id: string | null }) =>
      usersApi.assignCompany(id, company_id),
    onSuccess: () => {
      toast.success('Company assignment updated');
      qc.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to assign company');
    },
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.activate(id),
    onSuccess: () => { toast.success('User activated'); qc.invalidateQueries({ queryKey: userKeys.all }); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed');
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: userKeys.all }); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed');
    },
  });
}

export function useLockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lockout_minutes }: { id: string; lockout_minutes: number }) =>
      usersApi.lock(id, lockout_minutes),
    onSuccess: () => { toast.success('User locked'); qc.invalidateQueries({ queryKey: userKeys.all }); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed');
    },
  });
}

export function useUnlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.unlock(id),
    onSuccess: () => { toast.success('User unlocked'); qc.invalidateQueries({ queryKey: userKeys.all }); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed');
    },
  });
}

// ─── Agent access hooks ────────────────────────────────────────────────────────

export function useUserAgents(userId: string) {
  return useQuery({
    queryKey: userKeys.agents(userId),
    queryFn: () => usersApi.userAgents(userId),
    enabled: Boolean(userId),
  });
}

export function useToggleUserAgentAccess(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => usersApi.toggleAgentAccess(userId, agentId),
    onSuccess: (res) => {
      const msg = res?.message ?? (res?.data?.access_is_active ? 'Access activated' : 'Access deactivated');
      toast.success(msg);
      qc.invalidateQueries({ queryKey: userKeys.agents(userId) });
      qc.invalidateQueries({ queryKey: userKeys.diagnostic(userId) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to toggle access');
    },
  });
}

export function useUserGroups(userId: string) {
  return useQuery({
    queryKey: userKeys.groups(userId),
    queryFn: () => usersApi.userGroups(userId),
    enabled: Boolean(userId),
  });
}

export function useGrantUserAgentAccess(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { agent_id: string; expires_at?: string | null }) =>
      usersApi.grantAgentAccess(userId, payload),
    onSuccess: () => {
      toast.success('Access granted');
      qc.invalidateQueries({ queryKey: userKeys.agents(userId) });
      qc.invalidateQueries({ queryKey: userKeys.diagnostic(userId) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to grant access');
    },
  });
}

