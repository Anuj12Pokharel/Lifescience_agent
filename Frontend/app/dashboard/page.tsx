'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bot, Zap, ExternalLink, LogOut, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLogout } from '@/lib/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { agentsApi, type Agent } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function UserDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const logout = useLogout();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && (user.role === 'admin' || user.role === 'superadmin')) {
      router.push('/admin/dashboard');
    }
  }, [user, loading, router]);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['my-agents'],
    queryFn: agentsApi.myAgents,
    enabled: !!user,
  });

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#020B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #00D4FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020B18', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .agent-card { animation: fadeIn 0.3s ease forwards; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(0,100,200,0.2)', background: 'rgba(0,10,30,0.8)', backdropFilter: 'blur(20px)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#00D4FF" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#E8F4FF,#00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Life Science AI
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#00D4FF' }}>
              {user.email[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: 'rgba(160,200,240,0.7)' }}>{user.email}</span>
          </div>
          <Link href="/dashboard/usage" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, color: 'rgba(0,212,255,0.7)', fontSize: 13, textDecoration: 'none' }}>
            <Clock size={14} /> My Usage
          </Link>
          <button
            onClick={() => logout.mutate()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 8, color: 'rgba(255,100,100,0.8)', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#E8F4FF', marginBottom: 8, letterSpacing: '-0.03em' }}>
            Your AI Agents
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(120,170,220,0.6)' }}>
            All agents you have access to.
          </p>
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {Array(6).fill(0).map((_, i) => (
              <div key={i} style={{ height: 160, borderRadius: 16, background: 'rgba(0,20,50,0.6)', border: '1px solid rgba(0,100,180,0.15)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Bot size={28} color="rgba(0,212,255,0.4)" />
            </div>
            <p style={{ fontSize: 16, color: 'rgba(120,170,220,0.5)', fontWeight: 500 }}>No agents assigned to you yet</p>
            <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.3)', marginTop: 6 }}>Contact your admin to get access</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {agents.map((agent: Agent, idx: number) => (
              <div
                key={agent.id}
                className="agent-card"
                style={{ animationDelay: `${idx * 50}ms`, borderRadius: 16, background: 'rgba(0,15,40,0.8)', border: '1px solid rgba(0,100,180,0.2)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, transition: 'all 0.2s', cursor: 'default' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bot size={22} color="#00D4FF" />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#E8F4FF' }}>{agent.name}</div>
                      {agent.subtitle && <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>{agent.subtitle}</div>}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: agent.status === 'live' ? 'rgba(0,255,136,0.1)' : 'rgba(255,180,0,0.1)',
                    color: agent.status === 'live' ? '#00FF88' : '#FFB400',
                    border: `1px solid ${agent.status === 'live' ? 'rgba(0,255,136,0.2)' : 'rgba(255,180,0,0.2)'}`,
                  }}>
                    {agent.status?.toUpperCase() ?? 'UNKNOWN'}
                  </span>
                </div>

                {agent.description && (
                  <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.6)', lineHeight: 1.6, margin: 0 }}>
                    {agent.description.substring(0, 100)}{agent.description.length > 100 ? '...' : ''}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <span style={{ fontSize: 11, color: 'rgba(120,170,220,0.4)', textTransform: 'capitalize' }}>{agent.agent_type}</span>
                  {agent.slug && (
                    <Link
                      href={`/${agent.slug}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#00D4FF', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}
                    >
                      Open <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
