'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { membersApi, type InviteMember } from '@/lib/api-client';
import { Users, UserCheck, Clock, RefreshCw, Search, Send, Mail, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const roleBadge = (role: string) => {
  const map: Record<string, [string, string]> = {
    admin: ['#A78BFA', 'rgba(167,139,250,0.12)'],
    user:  ['#00D4FF', 'rgba(0,212,255,0.1)'],
  };
  const [color, bg] = map[role] ?? ['#888', 'rgba(136,136,136,0.1)'];
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: bg, color, border: `1px solid ${color}30`, fontWeight: 700, textTransform: 'uppercase' as const }}>
      {role}
    </span>
  );
};

const statusBadge = (m: InviteMember) => {
  if (m.signup_status === 'accepted') {
    return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(0,200,100,0.1)', color: '#00CC66', border: '1px solid rgba(0,200,100,0.3)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><UserCheck size={11} /> Accepted</span>;
  }
  if (m.is_expired) {
    return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,60,60,0.1)', color: '#FF6060', border: '1px solid rgba(255,60,60,0.3)', fontWeight: 700 }}>Expired</span>;
  }
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,180,0,0.1)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.3)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> Pending</span>;
};

// ─── Row ──────────────────────────────────────────────────────────────────────
function MemberRow({ member, onResend, resending }: { member: InviteMember; onResend: (id: string) => void; resending: boolean }) {
  return (
    <tr
      style={{ transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,100,180,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={S.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,100,180,0.15)', border: '1px solid rgba(0,100,180,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Mail size={13} color="rgba(0,200,255,0.6)" />
          </div>
          <span style={{ fontWeight: 600, color: '#E8F4FF', fontSize: 13 }}>{member.email}</span>
        </div>
      </td>
      <td style={S.td}>{roleBadge(member.invited_role)}</td>
      <td style={S.td}>{statusBadge(member)}</td>
      <td style={S.td}><span style={{ color: 'rgba(120,170,220,0.6)', fontSize: 12 }}>{fmt(member.invited_at)}</span></td>
      <td style={S.td}>
        <span style={{ color: member.is_expired ? 'rgba(255,100,100,0.6)' : 'rgba(120,170,220,0.6)', fontSize: 12 }}>
          {fmt(member.expires_at)}
        </span>
      </td>
      <td style={S.td}><span style={{ color: 'rgba(120,170,220,0.6)', fontSize: 12 }}>{member.signup_status === 'accepted' ? fmt(member.date_joined) : '—'}</span></td>
      <td style={{ ...S.td, textAlign: 'right' as const }}>
        {member.signup_status === 'pending' ? (
          <button
            onClick={() => onResend(member.invite_id)}
            disabled={resending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'rgba(0,150,255,0.1)', border: '1px solid rgba(0,150,255,0.25)', color: '#00D4FF', fontSize: 12, fontWeight: 600, cursor: resending ? 'not-allowed' : 'pointer', opacity: resending ? 0.6 : 1 }}
          >
            <Send size={11} /> {resending ? 'Sending…' : 'Resend'}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: 'rgba(120,170,220,0.3)' }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  td: { padding: '12px 16px', fontSize: 13, borderBottom: '1px solid rgba(0,100,180,0.08)', verticalAlign: 'middle' as const },
  th: { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'rgba(120,170,220,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid rgba(0,100,180,0.15)', whiteSpace: 'nowrap' as const, textAlign: 'left' as const },
};

// ══════════════════════════════════════════════════════════════════════════════
export default function AdminMembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted'>('all');
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-members'],
    queryFn: membersApi.list,
  });

  const resend = useMutation({
    mutationFn: (id: string) => membersApi.resend(id),
    onMutate: (id) => setResendingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-members'] });
      toast.success('Invite resent — link extended by 7 days');
      setResendingId(null);
    },
    onError: () => { toast.error('Failed to resend invite'); setResendingId(null); },
  });

  const allMembers = data?.members ?? [];
  const counts = data?.counts ?? {};

  const filtered = allMembers
    .filter(m => {
      if (filter === 'pending') return m.signup_status === 'pending';
      if (filter === 'accepted') return m.signup_status === 'accepted';
      return true;
    })
    .filter(m => m.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Invited Members</h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Track your invited members, monitor signup status, and resend expired invitations.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Invited', value: counts.total ?? allMembers.length, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: Users },
            { label: 'Signed Up',     value: counts.accepted ?? 0,             color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: UserCheck },
            { label: 'Pending Invite',value: counts.pending ?? 0,              color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock },
          ].map(({ label, value, color, bg, border, icon: Icon }) => (
            <div key={label} className={`rounded-xl ${bg} border ${border} p-5 flex items-center gap-4`}>
              <div className={`w-10 h-10 rounded-lg ${bg} border ${border} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <div className={`text-2xl font-black ${color}`}>{isLoading ? '—' : value}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter + Search bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-slate-900/60 border border-slate-700/50 rounded-lg p-1">
            {(['all', 'pending', 'accepted'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${filter === f ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              placeholder="Search by email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-900/60 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16 text-slate-500">Loading members…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">{allMembers.length === 0 ? '📬' : '🔍'}</div>
              <div className="text-slate-400 text-sm">
                {allMembers.length === 0 ? 'No members invited yet. Use the User Directory to send invitations.' : 'No members match your search.'}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-900/80">
                    <th style={S.th}>Email</th>
                    <th style={S.th}>Role</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Invited</th>
                    <th style={S.th}>Expires</th>
                    <th style={S.th}>Joined</th>
                    <th style={{ ...S.th, textAlign: 'right' as const }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <MemberRow
                      key={m.invite_id}
                      member={m}
                      onResend={id => resend.mutate(id)}
                      resending={resendingId === m.invite_id && resend.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tip */}
        {allMembers.length > 0 && (
          <p className="text-xs text-slate-600 text-center">
            Resending an invite extends the expiry by 7 days and sends a fresh link to the recipient's inbox.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
