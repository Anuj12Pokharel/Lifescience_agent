'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLogout } from '@/lib/hooks/use-auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { registrationsApi, type AdminRegistration } from '@/lib/api-client';
import { CheckCircle2, XCircle, Clock, Users, ChevronLeft, RefreshCw, Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const statusBadge = (status: AdminRegistration['approval_status']) => {
  if (status === 'approved') return <span style={BS.approved}>Approved</span>;
  if (status === 'rejected') return <span style={BS.rejected}>Rejected</span>;
  return <span style={BS.pending}>Pending</span>;
};

const BS = {
  approved: { fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(0,200,100,0.12)', color: '#00CC66', border: '1px solid rgba(0,200,100,0.3)', fontWeight: 700 },
  rejected:  { fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,60,60,0.1)', color: '#FF6060', border: '1px solid rgba(255,60,60,0.3)', fontWeight: 700 },
  pending:   { fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,180,0,0.1)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.3)', fontWeight: 700 },
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:   { minHeight: '100vh', background: '#020B18', fontFamily: 'Inter, sans-serif', color: '#E8F4FF' },
  header: { borderBottom: '1px solid rgba(255,180,0,0.2)', background: 'rgba(0,10,30,0.9)', backdropFilter: 'blur(20px)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky' as const, top: 0, zIndex: 50 },
  main:   { maxWidth: 1200, margin: '0 auto', padding: '40px 32px' },
  card:   { borderRadius: 14, background: 'rgba(0,15,40,0.8)', border: '1px solid rgba(0,100,180,0.2)', padding: '24px' },
  th:     { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(120,170,220,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid rgba(0,100,180,0.15)', whiteSpace: 'nowrap' as const },
  td:     { padding: '13px 14px', fontSize: 13, borderBottom: '1px solid rgba(0,100,180,0.08)', verticalAlign: 'middle' as const },
};

// ─── Row component ────────────────────────────────────────────────────────────
function AdminRow({ reg, onDecide }: { reg: AdminRegistration; onDecide: (r: AdminRegistration, action: 'approve' | 'reject') => void }) {
  const name = [reg.first_name, reg.last_name].filter(Boolean).join(' ') || '—';
  return (
    <tr style={{ transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,100,180,0.05)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <td style={S.td}>
        <div style={{ fontWeight: 600, color: '#E8F4FF' }}>{reg.email}</div>
        {name !== '—' && <div style={{ fontSize: 11, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>{name}</div>}
      </td>
      <td style={S.td}>{statusBadge(reg.approval_status)}</td>
      <td style={S.td}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'rgba(120,170,220,0.7)' }}>
          <Users size={13} /> {reg.member_count ?? 0}
        </span>
      </td>
      <td style={S.td}><span style={{ color: 'rgba(120,170,220,0.6)' }}>{fmt(reg.date_joined)}</span></td>
      <td style={{ ...S.td, textAlign: 'right' as const }}>
        {reg.approval_status === 'pending' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => onDecide(reg, 'approve')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, background: 'rgba(0,200,100,0.1)', border: '1px solid rgba(0,200,100,0.3)', color: '#00CC66', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <CheckCircle2 size={13} /> Approve
            </button>
            <button
              onClick={() => onDecide(reg, 'reject')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.25)', color: '#FF6060', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <XCircle size={13} /> Reject
            </button>
          </div>
        )}
        {reg.approval_status !== 'pending' && (
          <span style={{ fontSize: 12, color: 'rgba(120,170,220,0.35)' }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function SuperadminRegistrationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const logout = useLogout();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'superadmin') router.push('/admin/dashboard');
  }, [user, loading, router]);

  const [search, setSearch] = useState('');
  const [decideTarget, setDecideTarget] = useState<{ reg: AdminRegistration; action: 'approve' | 'reject' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['superadmin-registrations'],
    queryFn: registrationsApi.list,
    enabled: !!user,
  });

  const decide = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      registrationsApi.decide(id, action, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-registrations'] });
      toast.success(decideTarget?.action === 'approve' ? 'Admin approved' : 'Admin rejected');
      setDecideTarget(null);
      setRejectReason('');
    },
    onError: () => toast.error('Action failed'),
  });

  const openDecide = (reg: AdminRegistration, action: 'approve' | 'reject') => {
    setDecideTarget({ reg, action });
    setRejectReason('');
  };

  const confirmDecide = () => {
    if (!decideTarget) return;
    decide.mutate({ id: decideTarget.reg.id, action: decideTarget.action, reason: rejectReason || undefined });
  };

  const pending  = (data?.pending  ?? []).filter(r => r.email.toLowerCase().includes(search.toLowerCase()));
  const approved = (data?.approved ?? []).filter(r => r.email.toLowerCase().includes(search.toLowerCase()));
  const rejected = (data?.rejected ?? []).filter(r => r.email.toLowerCase().includes(search.toLowerCase()));

  const counts = data?.counts ?? {};

  if (loading || !user) return null;

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/superadmin" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(120,170,220,0.6)', fontSize: 13, textDecoration: 'none' }}>
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <span style={{ color: 'rgba(0,100,180,0.4)' }}>|</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#E8F4FF' }}>Admin Registrations</span>
          {(counts.pending ?? 0) > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,180,0,0.15)', color: '#FFB400', border: '1px solid rgba(255,180,0,0.3)' }}>
              {counts.pending} pending
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => refetch()} style={{ background: 'none', border: 'none', color: 'rgba(120,170,220,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => logout.mutate()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)', color: '#FF8080', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main style={S.main}>
        {/* Page title + search */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' as const }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#E8F4FF', letterSpacing: '-0.03em', marginBottom: 4 }}>Admin Registrations</h1>
            <p style={{ fontSize: 14, color: 'rgba(120,170,220,0.5)' }}>Review and approve admin account requests for your platform.</p>
          </div>
          <div style={{ position: 'relative' as const, flexShrink: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(120,170,220,0.4)', pointerEvents: 'none' }} />
            <input
              placeholder="Search by email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'rgba(0,20,50,0.8)', border: '1px solid rgba(0,100,180,0.3)', borderRadius: 9, fontSize: 13, color: '#E8F4FF', outline: 'none', width: 220 }}
            />
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Pending Review', value: counts.pending ?? 0, color: '#FFB400', bg: 'rgba(255,180,0,0.08)', border: 'rgba(255,180,0,0.2)', icon: Clock },
            { label: 'Approved Admins', value: counts.approved ?? 0, color: '#00CC66', bg: 'rgba(0,200,100,0.08)', border: 'rgba(0,200,100,0.2)', icon: CheckCircle2 },
            { label: 'Rejected', value: counts.rejected ?? 0, color: '#FF6060', bg: 'rgba(255,60,60,0.08)', border: 'rgba(255,60,60,0.2)', icon: XCircle },
          ].map(({ label, value, color, bg, border, icon: Icon }) => (
            <div key={label} style={{ borderRadius: 12, background: bg, border: `1px solid ${border}`, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{isLoading ? '—' : value}</div>
                <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)', marginTop: 3, fontWeight: 500 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending">
          <TabsList style={{ background: 'rgba(0,15,40,0.6)', border: '1px solid rgba(0,100,180,0.2)', borderRadius: 10, padding: 4, marginBottom: 20 }}>
            <TabsTrigger value="pending" style={{ borderRadius: 7, fontSize: 13 }}>
              Pending {pending.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'rgba(255,180,0,0.15)', color: '#FFB400', fontWeight: 700 }}>{pending.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="approved" style={{ borderRadius: 7, fontSize: 13 }}>Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="rejected" style={{ borderRadius: 7, fontSize: 13 }}>Rejected ({rejected.length})</TabsTrigger>
          </TabsList>

          {(['pending', 'approved', 'rejected'] as const).map(tab => {
            const rows = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected;
            return (
              <TabsContent key={tab} value={tab}>
                <div style={S.card}>
                  {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(120,170,220,0.4)' }}>Loading…</div>
                  ) : rows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>{tab === 'pending' ? '🎉' : tab === 'approved' ? '📋' : '📭'}</div>
                      <div style={{ color: 'rgba(120,170,220,0.5)', fontSize: 14 }}>
                        {tab === 'pending' ? 'No pending registrations' : tab === 'approved' ? 'No approved admins yet' : 'No rejected registrations'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' as const }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                        <thead>
                          <tr>
                            <th style={{ ...S.th, textAlign: 'left' as const }}>Email / Name</th>
                            <th style={{ ...S.th, textAlign: 'left' as const }}>Status</th>
                            <th style={{ ...S.th, textAlign: 'left' as const }}>Members</th>
                            <th style={{ ...S.th, textAlign: 'left' as const }}>Registered</th>
                            <th style={{ ...S.th, textAlign: 'right' as const }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(reg => (
                            <AdminRow key={reg.id} reg={reg} onDecide={openDecide} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Show rejection reasons for rejected tab */}
                  {tab === 'rejected' && rows.some(r => r.rejection_reason) && (
                    <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, background: 'rgba(255,60,60,0.04)', border: '1px solid rgba(255,60,60,0.12)' }}>
                      {rows.filter(r => r.rejection_reason).map(r => (
                        <div key={r.id} style={{ fontSize: 12, color: 'rgba(255,130,130,0.7)', marginTop: 6 }}>
                          <span style={{ fontWeight: 600, color: 'rgba(255,130,130,0.9)' }}>{r.email}:</span> {r.rejection_reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </main>

      {/* Confirm Dialog */}
      <Dialog open={!!decideTarget} onOpenChange={open => { if (!open) { setDecideTarget(null); setRejectReason(''); } }}>
        <DialogContent style={{ background: '#050E25', border: '1px solid rgba(0,100,180,0.25)', borderRadius: 16, color: '#E8F4FF' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#E8F4FF' }}>
              {decideTarget?.action === 'approve' ? '✅ Approve Admin' : '❌ Reject Admin'}
            </DialogTitle>
            <DialogDescription style={{ color: 'rgba(120,170,220,0.6)' }}>
              {decideTarget?.reg.email}
            </DialogDescription>
          </DialogHeader>

          {decideTarget?.action === 'approve' ? (
            <p style={{ fontSize: 14, color: 'rgba(120,170,220,0.7)', lineHeight: 1.6 }}>
              This will activate the admin account and send them a confirmation email so they can log in.
            </p>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: 'rgba(120,170,220,0.7)', lineHeight: 1.6, marginBottom: 12 }}>
                The admin will receive a rejection email. Optionally provide a reason.
              </p>
              <textarea
                placeholder="Reason for rejection (optional)…"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                style={{ width: '100%', background: 'rgba(0,20,50,0.8)', border: '1px solid rgba(0,100,180,0.3)', borderRadius: 9, padding: '10px 12px', fontSize: 13, color: '#E8F4FF', outline: 'none', resize: 'none', boxSizing: 'border-box' as const }}
              />
            </div>
          )}

          <DialogFooter style={{ gap: 8 }}>
            <Button variant="ghost" style={{ color: 'rgba(120,170,220,0.6)' }} onClick={() => { setDecideTarget(null); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmDecide}
              disabled={decide.isPending}
              style={decideTarget?.action === 'approve'
                ? { background: 'rgba(0,200,100,0.15)', border: '1px solid rgba(0,200,100,0.3)', color: '#00CC66' }
                : { background: 'rgba(255,60,60,0.12)', border: '1px solid rgba(255,60,60,0.3)', color: '#FF6060' }}
            >
              {decide.isPending ? 'Processing…' : decideTarget?.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
