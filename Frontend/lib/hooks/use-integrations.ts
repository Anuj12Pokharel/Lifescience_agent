import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { integrationsApi } from '@/lib/api-client';

const KEYS = {
  providers: (agentId?: string) => ['integrations', 'providers', agentId ?? 'all'] as const,
  adminProviders: (agentId?: string) => ['integrations', 'admin-providers', agentId ?? 'all'] as const,
  credentials: ['integrations', 'credentials'] as const,
};

export function useIntegrationProviders(agentId?: string) {
  return useQuery({
    queryKey: KEYS.providers(agentId),
    queryFn: () => integrationsApi.listProviders(agentId),
  });
}

export function useGetOAuthUrl() {
  return useMutation({
    mutationFn: integrationsApi.getOAuthUrl,
    onSuccess: (data) => {
      window.open(data.auth_url, '_blank', 'width=600,height=700');
    },
    onError: () => toast.error('Failed to get OAuth URL'),
  });
}

export function useConnectApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: integrationsApi.connectApiKey,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.credentials });
      toast.success(`${data.provider_name} connected`);
    },
    onError: () => toast.error('Failed to connect'),
  });
}

export function useIntegrationCredentials() {
  return useQuery({
    queryKey: KEYS.credentials,
    queryFn: integrationsApi.listCredentials,
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: integrationsApi.disconnect,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.credentials });
      toast.success('Integration disconnected');
    },
    onError: () => toast.error('Failed to disconnect'),
  });
}

// ─── Superadmin: provider management ─────────────────────────────────────────

export function useAdminProviders(agentId?: string) {
  return useQuery({
    queryKey: KEYS.adminProviders(agentId),
    queryFn: () => integrationsApi.listAdminProviders(agentId),
  });
}

export function useCreateAdminProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: integrationsApi.createAdminProvider,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', 'admin-providers'] });
      toast.success('Provider created');
    },
    onError: () => toast.error('Failed to create provider'),
  });
}

export function useUpdateAdminProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof integrationsApi.updateAdminProvider>[1] }) =>
      integrationsApi.updateAdminProvider(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', 'admin-providers'] });
      // Also invalidate the public providers list so admins see updated scopes immediately
      qc.invalidateQueries({ queryKey: ['integrations', 'providers'] });
      toast.success('Provider updated — users must reconnect to apply new scopes');
    },
    onError: () => toast.error('Failed to update provider'),
  });
}

export function useDeleteAdminProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: integrationsApi.deleteAdminProvider,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', 'admin-providers'] });
      toast.success('Provider deleted');
    },
    onError: () => toast.error('Failed to delete provider'),
  });
}

export function useUpdateMessengerConfig() {
  return useMutation({
    mutationFn: integrationsApi.updateMessengerConfig,
    onSuccess: () => toast.success('Channel saved'),
    onError: (err: any) => {
      if (err?.response?.status === 404) {
        // Endpoint not yet implemented on backend — fail silently
        toast.info('Channel config endpoint not available yet');
      } else {
        toast.error('Failed to save channel config');
      }
    },
  });
}

// ─── Gmail OAuth ─────────────────────────────────────────────────────────────

export function useGmailStatus() {
  return useQuery({
    queryKey: ['integrations', 'gmail', 'status'],
    queryFn: integrationsApi.getGmailStatus,
  });
}

export function useConnectGmail() {
  return useMutation({
    mutationFn: integrationsApi.getGmailOAuthUrl,
    onSuccess: (data) => {
      window.open(data.auth_url, '_self');
    },
    onError: () => toast.error('Failed to initiate Gmail connection'),
  });
}

export function useDisconnectGmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: integrationsApi.disconnectGmail,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', 'gmail', 'status'] });
      toast.success('Gmail disconnected');
    },
    onError: () => toast.error('Failed to disconnect Gmail'),
  });
}

