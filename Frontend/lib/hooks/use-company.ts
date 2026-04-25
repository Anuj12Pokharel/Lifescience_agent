import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  companyApi, eventsApi,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
  type EventPayload,
} from '@/lib/api-client';

// ─── Query keys ────────────────────────────────────────────────────────────────

export const companyKeys = {
  all: ['company'] as const,
  list: () => ['company', 'list'] as const,
  detail: (id: string) => ['company', id] as const,
  events: () => ['company', 'events'] as const,
};

// ─── Company queries ───────────────────────────────────────────────────────────

export function useCompanies() {
  return useQuery({
    queryKey: companyKeys.list(),
    queryFn: companyApi.list,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: companyKeys.detail(id),
    queryFn: () => companyApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => companyApi.create(payload),
    onSuccess: () => {
      toast.success('Company created');
      qc.invalidateQueries({ queryKey: companyKeys.all });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to create company');
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCompanyPayload }) =>
      companyApi.update(id, payload),
    onSuccess: (_, { id }) => {
      toast.success('Company updated');
      qc.invalidateQueries({ queryKey: companyKeys.all });
      qc.invalidateQueries({ queryKey: companyKeys.detail(id) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to update company');
    },
  });
}

export function useAssignAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, managed_by }: { id: string; managed_by: string | null }) =>
      companyApi.assignAdmin(id, managed_by),
    onSuccess: (_, { id }) => {
      toast.success('Admin assignment updated');
      qc.invalidateQueries({ queryKey: companyKeys.all });
      qc.invalidateQueries({ queryKey: companyKeys.detail(id) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to assign admin');
    },
  });
}

// ─── Events queries ────────────────────────────────────────────────────────────

export function useEvents() {
  return useQuery({
    queryKey: companyKeys.events(),
    queryFn: eventsApi.list,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EventPayload) => eventsApi.create(payload),
    onSuccess: () => {
      toast.success('Event created');
      qc.invalidateQueries({ queryKey: companyKeys.events() });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to create event');
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EventPayload> }) =>
      eventsApi.update(id, payload),
    onSuccess: () => {
      toast.success('Event updated');
      qc.invalidateQueries({ queryKey: companyKeys.events() });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to update event');
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.delete(id),
    onSuccess: () => {
      toast.success('Event deleted');
      qc.invalidateQueries({ queryKey: companyKeys.events() });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to delete event');
    },
  });
}

export function useToggleEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.toggle(id),
    onSuccess: (data) => {
      toast.success(`Event ${data.is_active ? 'activated' : 'deactivated'}`);
      qc.invalidateQueries({ queryKey: companyKeys.events() });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Failed to toggle event');
    },
  });
}
