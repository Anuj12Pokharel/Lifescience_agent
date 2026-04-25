import { useAuth } from '@/lib/auth-context';
import { useAgents } from '@/lib/hooks/use-agents';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AgentAccessCheckProps {
  agentSlug: string;
  children: (hasAccess: boolean, isLoading: boolean) => React.ReactNode;
}

// Map slugs to agent IDs for API calls
const SLUG_TO_AGENT_MAP: Record<string, string> = {
  'inquiry-booking': 'inquiry-booking',
  'project-tracking-agent': 'project-tracking-agent', 
  'data-analyst': 'data-analyst',
};

export function useAgentAccess(agentSlug: string) {
  const { user } = useAuth();
  const router = useRouter();
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<'active' | 'inactive' | null>(null);

  // Get agent ID from slug
  const agentId = SLUG_TO_AGENT_MAP[agentSlug];

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      setIsLoading(false);
      setAccessChecked(true);
      return;
    }

    if (!agentId) {
      setHasAccess(false);
      setIsLoading(false);
      setAccessChecked(true);
      return;
    }

    // Check if user has access to this agent and agent status
    const checkAccess = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/v1/agents/${agentId}/access-check`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHasAccess(data.has_access || data.data?.has_access || false);
          // Check if agent is inactive
          if (data.status === 'inactive' || data.data?.status === 'inactive') {
            setAgentStatus('inactive');
          } else {
            setAgentStatus('active');
          }
        } else {
          setHasAccess(false);
          setAgentStatus(null);
        }
      } catch (error) {
        console.error('Error checking agent access:', error);
        setHasAccess(false);
        setAgentStatus(null);
      } finally {
        setIsLoading(false);
        setAccessChecked(true);
      }
    };

    checkAccess();
  }, [user, agentId]);

  return { hasAccess, isLoading, accessChecked, agentStatus };
}

export function AgentAccessCheck({ agentSlug, children }: AgentAccessCheckProps) {
  const { hasAccess, isLoading, accessChecked, agentStatus } = useAgentAccess(agentSlug);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  // Show inactive agent message
  if (agentStatus === 'inactive' && accessChecked) {
    return (
      <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 bg-[#0a1428] border border-yellow-500/20 rounded-2xl">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Agent Currently Inactive</h1>
          <p className="text-gray-400 mb-6">
            This agent is currently under maintenance and temporarily unavailable. Please contact your administrator or wait until the agent is active again.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Go Back
            </button>
            <a
              href="/"
              className="block w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-center"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show no access message
  if (!hasAccess && accessChecked) {
    return (
      <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 bg-[#0a1428] border border-red-500/20 rounded-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Access Restricted</h1>
          <p className="text-gray-400 mb-6">
            You don&apos;t have access to this agent. Please contact your administrator for access to use this service.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Go Back
            </button>
            <a
              href="/"
              className="block w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-center"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Render children if has access
  return <>{children(hasAccess, isLoading)}</>;
}
