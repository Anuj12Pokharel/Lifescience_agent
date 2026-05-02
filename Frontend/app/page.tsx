'use client';

import { useState, useEffect, useRef } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Zap, MessageSquare, Microscope, BookOpen, BarChart3,
  Clock, Users, Brain, ShieldCheck, LogOut, Bot, Lock,
  KeyRound, Eye, EyeOff, CheckCircle, XCircle, X, Sparkles,
  Activity, Globe, ChevronRight, Play, Star,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLogout, useChangePassword } from "@/lib/hooks/use-auth";
import { usePublicAgents, useAgents } from "@/lib/hooks/use-agents";
import type { Agent as ApiAgent } from "@/lib/api-client";

// ─── Slug → app route ─────────────────────────────────────────────────────────
const SLUG_ROUTES: Record<string, string> = {
  "inquiry-booking":        "/chat",
  "project-tracking-agent": "/project-tracking-agent",
  "data-analyst":           "/data-analyst",
};
function getAgentRoute(slug: string): string | null { return SLUG_ROUTES[slug] ?? null; }

// ─── Visual config per slug ───────────────────────────────────────────────────
type IconComponent = React.ComponentType<{ size?: number; color?: string }>;
interface SlugStyle { icon: IconComponent; accent: string; glow: string; tag: string; }

const SLUG_STYLES: Record<string, SlugStyle> = {
  "inquiry-booking":        { icon: MessageSquare, accent: "#00D4FF", glow: "rgba(0,212,255,0.25)",   tag: "Communication" },
  "project-tracking-agent": { icon: Microscope,    accent: "#3B82F6", glow: "rgba(59,130,246,0.25)",  tag: "Research" },
  "data-analyst":           { icon: BarChart3,     accent: "#06B6D4", glow: "rgba(6,182,212,0.25)",   tag: "Analytics" },
  "data-security":          { icon: ShieldCheck,   accent: "#EF4444", glow: "rgba(239,68,68,0.25)",   tag: "Security" },
  "protocol-expert":        { icon: BookOpen,      accent: "#818CF8", glow: "rgba(129,140,248,0.25)", tag: "Protocols" },
  "knowledge-base":         { icon: Brain,         accent: "#A78BFA", glow: "rgba(167,139,250,0.25)", tag: "Knowledge" },
  "scheduler":              { icon: Clock,         accent: "#34D399", glow: "rgba(52,211,153,0.25)",  tag: "Scheduling" },
  "collaboration-hub":      { icon: Users,         accent: "#F472B6", glow: "rgba(244,114,182,0.25)", tag: "Collaboration" },
};
const DEFAULT_STYLE: SlugStyle = { icon: Bot, accent: "#00D4FF", glow: "rgba(0,212,255,0.25)", tag: "Agent" };
function getStyle(slug: string): SlugStyle { return SLUG_STYLES[slug] ?? DEFAULT_STYLE; }

function getButtonLabel(slug: string): string {
  const labels: Record<string, string> = {
    "inquiry-booking": "Launch Chat", "project-tracking-agent": "Track Projects", "data-analyst": "Analyze Data",
  };
  return labels[slug] ?? "Open Agent";
}

// ─── Neural canvas ────────────────────────────────────────────────────────────
function NeuralGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let animId: number; let w = 0, h = 0;
    interface Node { x: number; y: number; vx: number; vy: number; r: number; pulse: number; }
    const nodes: Node[] = [];
    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    resize(); window.addEventListener("resize", resize);
    for (let i = 0; i < 60; i++) {
      nodes.push({ x: Math.random() * (w || 800), y: Math.random() * (h || 500), vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: Math.random() * 1.8 + 0.4, pulse: Math.random() * Math.PI * 2 });
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      nodes.forEach(n => { n.x += n.vx; n.y += n.vy; n.pulse += 0.01; if (n.x < 0 || n.x > w) n.vx *= -1; if (n.y < 0 || n.y > h) n.vy *= -1; });
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.strokeStyle = `rgba(0,180,255,${(1 - dist / 140) * 0.12})`; ctx.lineWidth = 0.6; ctx.stroke(); }
      }
      nodes.forEach(n => { const p = (Math.sin(n.pulse) + 1) / 2; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + p, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,212,255,${0.35 + p * 0.35})`; ctx.fill(); });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.55 }} />;
}

// ─── Scrolling ticker ─────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  "🧬 Genomic Analysis", "⚗️ Protocol Management", "📊 Data Intelligence",
  "🔬 Lab Scheduling", "🤝 Team Collaboration", "🛡️ Data Security",
  "📚 Knowledge Base", "💬 Inquiry Booking", "⚡ Real-time Insights",
  "🌐 Multi-modal AI", "🔐 Enterprise Grade", "🧪 Research Automation",
];

function Ticker() {
  return (
    <div style={{ overflow: "hidden", borderTop: "1px solid rgba(0,100,200,0.1)", borderBottom: "1px solid rgba(0,100,200,0.1)", background: "rgba(0,10,30,0.4)", padding: "12px 0", position: "relative" }}>
      <div style={{ display: "flex", gap: "40px", animation: "tickerScroll 30s linear infinite", width: "max-content" }}>
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
          <span key={i} style={{ fontSize: "12px", color: "rgba(0,212,255,0.55)", whiteSpace: "nowrap", fontWeight: 500, letterSpacing: "0.05em" }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Password validation ──────────────────────────────────────────────────────
function validatePassword(pwd: string) {
  return { length: pwd.length >= 8, upper: /[A-Z]/.test(pwd), lower: /[a-z]/.test(pwd), digit: /\d/.test(pwd), special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd) };
}
const PWD_RULES = [
  { key: 'length', label: '8+ chars' }, { key: 'upper', label: 'Uppercase' },
  { key: 'lower', label: 'Lowercase' }, { key: 'digit', label: 'Number' },
  { key: 'special', label: 'Special char' },
] as const;

// ─── Change-password dialog ───────────────────────────────────────────────────
function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const changePassword = useChangePassword();
  const [form, setForm] = useState({ old_password: '', new_password: '', new_password_confirm: '' });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const rules = validatePassword(form.new_password);
  const allValid = Object.values(rules).every(Boolean);
  const passwordsMatch = form.new_password === form.new_password_confirm && form.new_password_confirm !== '';
  const fieldErrors: Record<string, string[]> = (changePassword.error as { response?: { data?: { error?: { details?: Record<string, string[]> } } } })?.response?.data?.error?.details ?? {};
  const globalError: string = (changePassword.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? '';
  const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(0,20,50,0.8)', border: '1px solid rgba(0,100,180,0.3)', borderRadius: 10, padding: '11px 40px', fontSize: 14, color: '#E8F4FF', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: 'rgba(2,11,24,0.99)', border: '1px solid rgba(0,100,200,0.3)', borderRadius: 20, padding: '28px', width: '100%', maxWidth: 420, boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,212,255,0.05)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer', color: 'rgba(120,170,220,0.6)', padding: '4px', display: 'flex' }}>
          <X size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,100,200,0.1))', border: '1px solid rgba(0,212,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KeyRound size={18} color="#00D4FF" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#E8F4FF' }}>Change Password</div>
            <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)', marginTop: 2 }}>Update your account credentials</div>
          </div>
        </div>
        {globalError && <div style={{ background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FF8080', marginBottom: 16 }}>{globalError}</div>}
        <form onSubmit={(e) => { e.preventDefault(); if (!allValid || !passwordsMatch) return; changePassword.mutate(form, { onSuccess: () => { setForm({ old_password: '', new_password: '', new_password_confirm: '' }); onClose(); } }); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(160,200,240,0.7)', marginBottom: 6 }}>Current Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,150,220,0.5)', pointerEvents: 'none' }}><Lock size={14} /></span>
              <input style={inputStyle} type={showOld ? 'text' : 'password'} placeholder="Current password" value={form.old_password} onChange={(e) => setForm({ ...form, old_password: e.target.value })} required />
              <button type="button" onClick={() => setShowOld(!showOld)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,150,220,0.5)', display: 'flex' }}>{showOld ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
            {fieldErrors.old_password?.map((err, i) => <p key={i} style={{ fontSize: 12, color: '#FF8080', marginTop: 4 }}>{err}</p>)}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(160,200,240,0.7)', marginBottom: 6 }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,150,220,0.5)', pointerEvents: 'none' }}><Lock size={14} /></span>
              <input style={inputStyle} type={showNew ? 'text' : 'password'} placeholder="New password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required />
              <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,150,220,0.5)', display: 'flex' }}>{showNew ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
            {form.new_password && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {PWD_RULES.map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    {rules[key] ? <CheckCircle size={10} color="#00FF88" /> : <XCircle size={10} color="#FF5050" />}
                    <span style={{ color: rules[key] ? '#00FF88' : 'rgba(255,120,120,0.7)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
            {fieldErrors.new_password?.map((err, i) => <p key={i} style={{ fontSize: 12, color: '#FF8080', marginTop: 4 }}>{err}</p>)}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(160,200,240,0.7)', marginBottom: 6 }}>Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,150,220,0.5)', pointerEvents: 'none' }}><Lock size={14} /></span>
              <input style={inputStyle} type={showNew ? 'text' : 'password'} placeholder="Repeat new password" value={form.new_password_confirm} onChange={(e) => setForm({ ...form, new_password_confirm: e.target.value })} required />
            </div>
            {form.new_password_confirm && !passwordsMatch && <p style={{ fontSize: 12, color: '#FF8080', marginTop: 4 }}>Passwords do not match</p>}
            {fieldErrors.new_password_confirm?.map((err, i) => <p key={i} style={{ fontSize: 12, color: '#FF8080', marginTop: 4 }}>{err}</p>)}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', background: 'rgba(0,100,200,0.08)', border: '1px solid rgba(0,100,200,0.2)', borderRadius: 10, color: 'rgba(160,200,240,0.6)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button type="submit" disabled={changePassword.isPending || !allValid || !passwordsMatch || !form.old_password}
              style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#0096FF,#0050C8)', border: 'none', borderRadius: 10, color: '#fff', cursor: changePassword.isPending || !allValid || !passwordsMatch || !form.old_password ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: changePassword.isPending || !allValid || !passwordsMatch || !form.old_password ? 0.5 : 1 }}>
              {changePassword.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── User avatar menu ─────────────────────────────────────────────────────────
function UserAvatarMenu({ email, role, onLogout, logoutPending }: { email: string; role: string; onLogout: () => void; logoutPending: boolean; }) {
  const [open, setOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = email[0].toUpperCase();
  const isAdmin = role === 'superadmin' || role === 'admin';
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setOpen(o => !o)} aria-label="User menu"
          style={{ width: 40, height: 40, borderRadius: '50%', background: open ? 'linear-gradient(135deg,rgba(0,212,255,0.25),rgba(0,100,200,0.2))' : 'linear-gradient(135deg,rgba(0,150,255,0.2),rgba(0,80,200,0.15))', border: `2px solid ${open ? 'rgba(0,212,255,0.7)' : 'rgba(0,212,255,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#00D4FF', cursor: 'pointer', transition: 'all 0.2s', boxShadow: open ? '0 0 20px rgba(0,212,255,0.35)' : 'none' }}>
          {initial}
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, width: 230, background: 'rgba(2,11,28,0.99)', border: '1px solid rgba(0,100,200,0.2)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,255,0.04)', overflow: 'hidden', zIndex: 400, animation: 'fadeSlideDown 0.18s ease both' }}>
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(0,100,200,0.1)', background: 'rgba(0,20,50,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,100,200,0.15))', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#00D4FF', flexShrink: 0 }}>{initial}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E8F4FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                  <div style={{ fontSize: 11, color: isAdmin ? '#F59E0B' : 'rgba(0,212,255,0.6)', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isAdmin ? <><ShieldCheck size={10} /> Admin</> : <><Activity size={10} /> User</>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: '6px 0' }}>
              {isAdmin && (
                <Link href="/admin/dashboard" onClick={() => setOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'rgba(245,158,11,0.9)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <ShieldCheck size={14} /> Admin Panel
                </Link>
              )}
              <button onClick={() => { setOpen(false); setShowChangePwd(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, color: 'rgba(160,200,240,0.85)', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,100,200,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <KeyRound size={14} /> Change Password
              </button>
              <div style={{ height: 1, background: 'rgba(0,100,200,0.1)', margin: '4px 8px' }} />
              <button onClick={() => { setOpen(false); onLogout(); }} disabled={logoutPending}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, color: 'rgba(255,90,90,0.8)', cursor: logoutPending ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: logoutPending ? 0.6 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,80,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <LogOut size={14} /> {logoutPending ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        )}
      </div>
      {showChangePwd && <ChangePasswordDialog onClose={() => setShowChangePwd(false)} />}
    </>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({ agent, index, isFeatured, isLoggedIn }: { agent: ApiAgent; index: number; isFeatured: boolean; isLoggedIn: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [noAccess, setNoAccess] = useState(false);
  const router = useRouter();
  const { icon: Icon, accent, glow, tag } = getStyle(agent.slug);
  const hasAccess  = agent.has_access === true;
  const isLive     = agent.status === 'live';
  const isInactive = agent.is_active === false;
  const canLaunch  = isLoggedIn && hasAccess && !isInactive;

  const handleClick = () => {
    if (!isLoggedIn) { router.push('/login'); return; }
    if (!hasAccess)  { setNoAccess(true); setTimeout(() => setNoAccess(false), 3000); return; }
    const route = getAgentRoute(agent.slug);
    if (route) router.push(route);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      className={`agent-card agent-card--${isFeatured ? "featured" : "normal"}`}
      style={{
        background: hovered
          ? `linear-gradient(145deg,rgba(0,18,48,0.97),rgba(0,28,68,0.97))`
          : "rgba(0,10,30,0.75)",
        border: `1px solid ${hovered ? accent + "55" : "rgba(0,80,160,0.18)"}`,
        borderRadius: "18px", padding: isFeatured ? "28px" : "22px",
        cursor: "pointer", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        transform: hovered ? "translateY(-5px)" : "translateY(0)",
        boxShadow: hovered ? `0 24px 64px ${glow}, inset 0 1px 0 rgba(255,255,255,0.04)` : "0 2px 16px rgba(0,0,0,0.35)",
        backdropFilter: "blur(20px)", position: "relative", overflow: "hidden",
        animationDelay: `${index * 70}ms`, animation: "fadeSlideUp 0.55s ease both",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Top glow orb */}
      <div style={{ position: "absolute", top: -40, right: -30, width: 160, height: 160, background: `radial-gradient(circle,${accent}18 0%,transparent 65%)`, borderRadius: "50%", transition: "opacity 0.4s", opacity: hovered ? 1 : 0.3, pointerEvents: "none" }} />

      {/* Scan line on featured hover */}
      {hovered && isFeatured && (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,transparent 0%,${accent}06 50%,transparent 100%)`, animation: "scanLine 2s linear infinite", pointerEvents: "none" }} />
      )}

      {/* No-access toast */}
      {noAccess && (
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(255,60,60,0.12)", border: "1px solid rgba(255,60,60,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#FF8888", whiteSpace: "nowrap", zIndex: 10, backdropFilter: "blur(8px)" }}>
          🔒 Access restricted
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, background: `linear-gradient(135deg,${accent}28,${accent}0f)`, border: `1px solid ${accent}44`, borderRadius: "13px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s", transform: hovered ? "scale(1.08) rotate(-4deg)" : "scale(1)", boxShadow: hovered ? `0 0 24px ${accent}44` : "none", flexShrink: 0 }}>
              <Icon size={22} color={accent} />
            </div>
            {/* Tag chip */}
            <span style={{ fontSize: "10px", fontWeight: 700, color: accent, background: `${accent}18`, border: `1px solid ${accent}33`, borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>{tag}</span>
          </div>

          {/* Status badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: isInactive ? "rgba(255,40,50,0.07)" : isLive ? "rgba(0,255,120,0.07)" : "rgba(255,50,70,0.05)", border: `1px solid ${isInactive ? "rgba(255,40,50,0.25)" : isLive ? "rgba(0,255,120,0.2)" : "rgba(255,50,70,0.15)"}`, borderRadius: 20, padding: "4px 10px" }}>
            <div style={{ width: 6, height: 6, background: isInactive ? "#FF3040" : isLive ? "#00FF88" : "#FF3C50", borderRadius: "50%", animation: isLive && !isInactive ? "pulseGreen 2s infinite" : "none", boxShadow: isLive && !isInactive ? "0 0 6px #00FF88" : "none" }} />
            <span style={{ fontSize: "10px", color: isInactive ? "#FF3040" : isLive ? "#00FF88" : "#FF3C50", fontWeight: 700 }}>
              {isInactive ? "Inactive" : isLive ? "Live" : agent.status ?? "Offline"}
            </span>
          </div>
        </div>

        {/* Name & subtitle */}
        <h3 style={{ fontSize: isFeatured ? "17px" : "15px", fontWeight: 700, color: "#E8F4FF", marginBottom: 4, lineHeight: 1.3 }}>{agent.name}</h3>
        {agent.subtitle && <p style={{ fontSize: "11px", color: accent, marginBottom: 10, fontWeight: 600, letterSpacing: "0.02em" }}>{agent.subtitle}</p>}
        <p style={{ fontSize: "13px", color: "rgba(150,195,240,0.65)", marginBottom: 16, lineHeight: 1.65, flex: 1 }}>{agent.description ?? ""}</p>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, background: "rgba(0,15,45,0.5)", border: "1px solid rgba(0,80,180,0.12)", borderRadius: 10, padding: "10px 8px", marginBottom: 16 }}>
          {[
            { label: "Status",     value: agent.status ?? "—" },
            { label: "Latency",    value: agent.latency ?? "—" },
            { label: "Efficiency", value: agent.efficiency != null ? `${agent.efficiency}%` : "—" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "rgba(80,130,190,0.6)", marginBottom: 3, fontWeight: 500 }}>{stat.label}</div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: accent }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Efficiency bar */}
        {agent.efficiency != null && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "rgba(100,150,200,0.5)" }}>Performance</span>
              <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>{agent.efficiency}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(0,80,200,0.15)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${agent.efficiency}%`, background: `linear-gradient(90deg,${accent}66,${accent})`, borderRadius: 4, boxShadow: `0 0 10px ${accent}66`, transition: "width 1s ease" }} />
            </div>
          </div>
        )}

        {/* CTA button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "11px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700,
            cursor: isInactive ? "not-allowed" : "pointer",
            border: canLaunch ? `1px solid ${accent}55` : "1px solid rgba(80,120,180,0.2)",
            background: canLaunch
              ? (hovered ? `linear-gradient(135deg,${accent}33,${accent}18)` : `${accent}15`)
              : "rgba(255,255,255,0.03)",
            color: canLaunch ? accent : "rgba(120,160,200,0.4)",
            transition: "all 0.2s",
            opacity: isInactive ? 0.45 : 1,
          }}
        >
          {!isLoggedIn ? (
            <><Lock size={13} /> Sign In to Access</>
          ) : !hasAccess ? (
            <><Lock size={13} /> Request Access</>
          ) : isInactive ? (
            <><Activity size={13} /> Unavailable</>
          ) : (
            <><Play size={13} fill={accent} /> {getButtonLabel(agent.slug)}</>
          )}
          {canLaunch && <ArrowRight size={13} style={{ marginLeft: 2 }} />}
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard({ isFeatured }: { isFeatured: boolean }) {
  return (
    <div className={`agent-card agent-card--${isFeatured ? "featured" : "normal"}`}
      style={{ background: "rgba(0,8,24,0.7)", border: "1px solid rgba(0,80,160,0.1)", borderRadius: 18, padding: isFeatured ? 28 : 22, animation: "shimmer 1.5s ease-in-out infinite" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: "rgba(0,80,180,0.1)" }} />
          <div style={{ width: 60, height: 20, borderRadius: 20, background: "rgba(0,80,180,0.08)" }} />
        </div>
        <div style={{ width: 56, height: 22, borderRadius: 20, background: "rgba(0,80,180,0.07)" }} />
      </div>
      {[140, 90, "100%", "100%", "85%"].map((w, i) => (
        <div key={i} style={{ height: i < 2 ? 14 : 10, width: w, background: "rgba(0,80,180,0.07)", borderRadius: 4, marginBottom: 10 }} />
      ))}
      <div style={{ height: 42, borderRadius: 12, background: "rgba(0,80,180,0.06)", marginTop: 8 }} />
    </div>
  );
}

// ─── How it Works step ────────────────────────────────────────────────────────
function StepCard({ n, title, desc, icon, accent }: { n: number; title: string; desc: string; icon: React.ReactNode; accent: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", background: hovered ? "rgba(0,15,45,0.9)" : "rgba(0,10,30,0.6)", border: `1px solid ${hovered ? accent + "44" : "rgba(0,80,160,0.15)"}`, borderRadius: 18, padding: "28px 24px", transition: "all 0.3s", transform: hovered ? "translateY(-4px)" : "none", boxShadow: hovered ? `0 16px 48px ${accent}22` : "none" }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg,${accent}22,${accent}0c)`, border: `1px solid ${accent}44`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        {icon}
      </div>
      <div style={{ position: "absolute", top: 20, right: 22, fontSize: 42, fontWeight: 900, color: `${accent}12`, lineHeight: 1 }}>{n}</div>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: "#E8F4FF", marginBottom: 8 }}>{title}</h4>
      <p style={{ fontSize: 13, color: "rgba(140,185,230,0.65)", lineHeight: 1.7 }}>{desc}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const ROLE_DASHBOARD: Record<string, string> = { superadmin: '/superadmin', admin: '/admin', user: '/dashboard' };

export default function LandingPage() {
  const [tick, setTick] = useState(0);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const logout = useLogout();

  useEffect(() => {
    if (!authLoading && user?.role) {
      const dest = ROLE_DASHBOARD[user.role];
      if (dest) router.replace(dest);
    }
  }, [user, authLoading, router]);

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const { data: publicData, isLoading: publicLoading } = usePublicAgents();
  const { data: adminData, isLoading: adminLoading }   = useAgents({}, isAdmin);
  const agentsLoading = isAdmin ? adminLoading : publicLoading;
  const agents = isAdmin ? (adminData?.results ?? []) : (publicData?.results ?? []);
  const liveCount  = agents.filter(a => a.status === 'live').length;
  const totalCount = agents.length;
  const accessibleCount = agents.filter(a => a.has_access).length;

  const statusItems = agentsLoading
    ? [{ label: "Initialising", value: "…" }]
    : [
        { label: "Network",  value: liveCount > 0 ? "Online" : "Standby" },
        { label: "Agents",   value: `${liveCount}/${totalCount}` },
        { label: "Latency",  value: "12ms" },
        { label: "Uptime",   value: "99.99%" },
      ];

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 2500); return () => clearInterval(id); }, []);

  const structuredData = {
    "@context": "https://schema.org", "@type": "WebApplication", "name": "Life Science AI",
    "applicationCategory": "ScienceApplication", "operatingSystem": "Web Browser",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "featureList": ["AI-powered research assistance", "Laboratory booking system", "Voice and text interaction", "Multi-modal input support", "Real-time collaboration", "Enterprise-grade security"],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #020B18; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #020B18; }
        ::-webkit-scrollbar-thumb { background: #0A2850; border-radius: 3px; }

        @keyframes fadeSlideUp   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeSlideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulseGreen    { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.4;transform:scale(0.8);} }
        @keyframes scanLine      { 0%{transform:translateY(-100%);} 100%{transform:translateY(220%);} }
        @keyframes floatOrb      { 0%,100%{transform:translateY(0) translateX(0);} 33%{transform:translateY(-18px) translateX(12px);} 66%{transform:translateY(10px) translateX(-14px);} }
        @keyframes pulseDot      { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes tickerScroll  { from{transform:translateX(0);} to{transform:translateX(-50%);} }
        @keyframes shimmer       { 0%,100%{opacity:0.5;} 50%{opacity:0.85;} }
        @keyframes gradientShift { 0%{background-position:0% 50%;} 50%{background-position:100% 50%;} 100%{background-position:0% 50%;} }
        @keyframes borderGlow    { 0%,100%{border-color:rgba(0,212,255,0.2);} 50%{border-color:rgba(0,212,255,0.5);} }

        .page-root { min-height:100vh; background:#020B18; font-family:'Inter',sans-serif; color:#E8F4FF; overflow-x:hidden; }

        .agent-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
        .agent-card--featured { grid-column:span 2; }
        .agent-card--normal   { grid-column:span 1; }
        @media(max-width:1100px) { .agent-grid{grid-template-columns:repeat(2,1fr);} .agent-card--featured{grid-column:span 2;} .agent-card--normal{grid-column:span 1;} }
        @media(max-width:560px)  { .agent-grid{grid-template-columns:1fr;} .agent-card--featured,.agent-card--normal{grid-column:span 1;} }

        .steps-grid    { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .features-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .trust-grid    { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        @media(max-width:900px)  { .steps-grid,.features-grid{grid-template-columns:repeat(2,1fr);} .trust-grid{grid-template-columns:repeat(2,1fr);} }
        @media(max-width:520px)  { .steps-grid,.features-grid,.trust-grid{grid-template-columns:1fr;} }

        .stats-strip { display:flex; align-items:center; justify-content:center; gap:0; flex-wrap:wrap; }
        .stat-item   { text-align:center; padding:20px 36px; border-right:1px solid rgba(0,80,160,0.15); }
        .stat-item:last-child { border-right:none; }
        @media(max-width:640px) { .stat-item{padding:16px 20px;} }

        .cta-section { background:linear-gradient(135deg,rgba(0,20,60,0.9),rgba(0,40,100,0.7)); border:1px solid rgba(0,212,255,0.15); border-radius:24px; padding:52px 40px; text-align:center; position:relative; overflow:hidden; }
        @media(max-width:520px) { .cta-section{padding:36px 20px; border-radius:16px;} }

        .hero-title-gradient { background:linear-gradient(135deg,#FFFFFF 0%,#B8D8FF 35%,#00D4FF 65%,#3B82F6 100%); background-size:200% 200%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:gradientShift 6s ease infinite; }

        .nav-status { display:flex; align-items:center; gap:6px; background:rgba(0,212,255,0.05); border:1px solid rgba(0,212,255,0.15); border-radius:20px; padding:6px 12px; animation:borderGlow 4s ease infinite; }
        @media(max-width:440px) { .nav-status-text { display:none; } }

        .logo-sub { font-size:11px; color:rgba(0,212,255,0.55); font-weight:500; }
        @media(max-width:360px) { .logo-sub{display:none;} }

        .section-pad  { padding:0 24px 88px; }
        .section-pad2 { padding:64px 24px; }
        @media(max-width:520px) { .section-pad{padding:0 12px 56px;} .section-pad2{padding:44px 12px;} }
      `}</style>

      <div className="page-root">

        {/* ── Ambient orbs ── */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "5%", left: "10%", width: "clamp(200px,38vw,560px)", height: "clamp(200px,38vw,560px)", background: "radial-gradient(circle,rgba(0,80,200,0.1) 0%,transparent 65%)", animation: "floatOrb 14s ease-in-out infinite", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: "10%", right: "8%", width: "clamp(160px,32vw,480px)", height: "clamp(160px,32vw,480px)", background: "radial-gradient(circle,rgba(0,180,255,0.07) 0%,transparent 65%)", animation: "floatOrb 18s ease-in-out infinite reverse", borderRadius: "50%" }} />
          <div style={{ position: "absolute", top: "40%", left: "55%", width: "clamp(120px,25vw,350px)", height: "clamp(120px,25vw,350px)", background: "radial-gradient(circle,rgba(59,130,246,0.06) 0%,transparent 65%)", animation: "floatOrb 22s ease-in-out infinite", borderRadius: "50%" }} />
        </div>

        {/* ── Header ── */}
        <header style={{ position: "sticky", top: 0, zIndex: 200, borderBottom: "1px solid rgba(0,80,180,0.12)", background: "rgba(2,11,24,0.88)", backdropFilter: "blur(24px)" }}>
          <nav style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, minWidth: 0 }}>
              <Image src="/logo.png" alt="Life Science AI" width={36} height={36} style={{ objectFit: "contain", flexShrink: 0 }} priority />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "clamp(14px,3.5vw,18px)", fontWeight: 800, letterSpacing: "-0.04em", background: "linear-gradient(135deg,#E8F4FF,#00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "nowrap" }}>Life Science AI</div>
                <div className="logo-sub">Next-gen intelligence</div>
              </div>
            </div>

            {/* Status ticker */}
            <div className="nav-status">
              <div style={{ width: 7, height: 7, background: "#00FF88", borderRadius: "50%", animation: "pulseDot 2s infinite", boxShadow: "0 0 8px #00FF88", flexShrink: 0 }} />
              <span className="nav-status-text" style={{ fontSize: 12, color: "rgba(0,212,255,0.8)", whiteSpace: "nowrap" }}>
                {statusItems[tick % statusItems.length].label}: <strong style={{ color: "#00D4FF" }}>{statusItems[tick % statusItems.length].value}</strong>
              </span>
            </div>

            {/* Auth */}
            {!authLoading && (
              user ? (
                <UserAvatarMenu email={user.email} role={user.role} onLogout={() => logout.mutate()} logoutPending={logout.isPending} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: "rgba(0,212,255,0.85)", textDecoration: "none", padding: "7px 16px", border: "1px solid rgba(0,212,255,0.22)", borderRadius: 22, background: "rgba(0,212,255,0.05)", whiteSpace: "nowrap", transition: "all 0.2s" }}>Sign In</Link>
                  <Link href="/register" style={{ fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none", padding: "7px 16px", borderRadius: 22, background: "linear-gradient(135deg,#0096FF,#3B82F6)", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,150,255,0.3)" }}>Get Started</Link>
                </div>
              )
            )}
          </nav>
        </header>

        <main style={{ position: "relative", zIndex: 1 }}>

          {/* ── Hero ── */}
          <section style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "clamp(60px,9vw,110px) 24px clamp(48px,6vw,80px)", textAlign: "center", overflow: "hidden" }}>
            <NeuralGrid />
            <div style={{ position: "relative", zIndex: 2 }}>

              {/* Badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.22)", borderRadius: 32, padding: "8px 20px", marginBottom: 30, flexWrap: "wrap", justifyContent: "center", animation: "fadeSlideUp 0.5s ease both" }}>
                <Sparkles size={13} color="#00D4FF" />
                <span style={{ fontSize: 13, color: "#00D4FF", fontWeight: 600 }}>Powered by Advanced AI</span>
                <div style={{ width: 1, height: 14, background: "rgba(0,212,255,0.25)" }} />
                <span style={{ fontSize: 11, color: "rgba(0,212,255,0.45)", fontWeight: 500 }}>v3.1.0 — Production</span>
              </div>

              {/* Title */}
              <h1 className="hero-title-gradient" style={{ fontSize: "clamp(38px,7vw,80px)", fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1.05, marginBottom: 20, animation: "fadeSlideUp 0.55s 0.05s ease both" }}>
                Life Science AI
              </h1>
              <h2 style={{ fontSize: "clamp(16px,2.5vw,22px)", fontWeight: 400, color: "rgba(150,200,240,0.55)", letterSpacing: "-0.02em", marginBottom: 24, animation: "fadeSlideUp 0.55s 0.1s ease both" }}>
                Intelligence built for the lab
              </h2>

              {/* Subtitle */}
              <p style={{ fontSize: "clamp(14px,1.8vw,17px)", color: "rgba(130,180,230,0.7)", maxWidth: 580, margin: "0 auto 40px", lineHeight: 1.75, animation: "fadeSlideUp 0.55s 0.15s ease both" }}>
                {agentsLoading ? (
                  <span style={{ color: "rgba(0,212,255,0.4)" }}>Connecting to agent network…</span>
                ) : user ? (
                  <>
                    <span style={{ color: "#00D4FF", fontWeight: 700 }}>{totalCount} specialised AI agent{totalCount !== 1 ? "s" : ""}</span>
                    {" "}at your disposal — Welcome back,{" "}
                    <span style={{ color: "#E8F4FF", fontWeight: 600 }}>{user.email.split("@")[0]}</span>.{" "}
                    <span style={{ color: "rgba(0,255,136,0.7)" }}>{accessibleCount} agent{accessibleCount !== 1 ? "s" : ""} accessible.</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: "#00D4FF", fontWeight: 700 }}>{totalCount} specialised AI agent{totalCount !== 1 ? "s" : ""}</span>
                    {" "}engineered for life science research, inquiry management, and intelligent scheduling — always online, always instant.
                  </>
                )}
              </p>

              {/* CTAs */}
              {!user && (
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animation: "fadeSlideUp 0.55s 0.2s ease both" }}>
                  <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#fff", textDecoration: "none", padding: "13px 28px", borderRadius: 14, background: "linear-gradient(135deg,#0096FF,#3B82F6)", boxShadow: "0 8px 32px rgba(0,150,255,0.35)", transition: "all 0.2s" }}>
                    <Zap size={16} /> Start Free Today <ArrowRight size={15} />
                  </Link>
                  <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "rgba(0,212,255,0.85)", textDecoration: "none", padding: "13px 28px", borderRadius: 14, border: "1px solid rgba(0,212,255,0.25)", background: "rgba(0,212,255,0.05)", transition: "all 0.2s" }}>
                    Sign In <ChevronRight size={15} />
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* ── Stats strip ── */}
          <div style={{ borderTop: "1px solid rgba(0,80,160,0.12)", borderBottom: "1px solid rgba(0,80,160,0.12)", background: "rgba(0,8,24,0.5)", backdropFilter: "blur(12px)" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <div className="stats-strip">
                {[
                  { label: "AI Agents",     value: agentsLoading ? "—" : String(totalCount),         sub: "Specialised" },
                  { label: "Uptime SLA",    value: "99.99%",  sub: "Enterprise" },
                  { label: "Avg Response",  value: "< 3s",    sub: "Optimised" },
                  { label: "Availability",  value: "24 / 7",  sub: "Always On" },
                ].map(s => (
                  <div key={s.label} className="stat-item">
                    <div style={{ fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 800, letterSpacing: "-0.04em", background: "linear-gradient(135deg,#00D4FF,#3B82F6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "rgba(0,212,255,0.45)", marginTop: 3, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.sub}</div>
                    <div style={{ fontSize: 12, color: "rgba(100,150,200,0.5)", marginTop: 1 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Ticker ── */}
          <Ticker />

          {/* ── Section label ── */}
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 24px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,rgba(0,100,200,0.25))" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={13} color="rgba(0,212,255,0.5)" />
                <span style={{ fontSize: 12, color: "rgba(0,212,255,0.5)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  Agent Network — {agentsLoading ? "Connecting" : `${liveCount} Live`}
                </span>
              </div>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(0,100,200,0.25),transparent)" }} />
            </div>
          </div>

          {/* ── Agent Grid ── */}
          <section style={{ maxWidth: 1280, margin: "0 auto" }} className="section-pad">
            <div className="agent-grid">
              {agentsLoading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} isFeatured={i === 0} />)
                : agents.map((agent, i) => (
                    <AgentCard key={agent.id} agent={agent} index={i} isFeatured={i === 0} isLoggedIn={Boolean(user)} />
                  ))
              }
            </div>
          </section>

          {/* ── How It Works ── */}
          <section style={{ borderTop: "1px solid rgba(0,80,160,0.12)", background: "rgba(0,8,24,0.45)", backdropFilter: "blur(12px)" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }} className="section-pad2">
              <div style={{ textAlign: "center", marginBottom: 44 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 24, padding: "6px 16px", marginBottom: 16 }}>
                  <Zap size={12} color="#00D4FF" />
                  <span style={{ fontSize: 12, color: "rgba(0,212,255,0.7)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>How It Works</span>
                </div>
                <h2 style={{ fontSize: "clamp(22px,3.5vw,34px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#E8F4FF" }}>From login to insight in seconds</h2>
                <p style={{ fontSize: 14, color: "rgba(120,170,220,0.55)", marginTop: 10, maxWidth: 460, margin: "10px auto 0" }}>Three simple steps to unlock the full power of your AI research network.</p>
              </div>
              <div className="steps-grid">
                <StepCard n={1} accent="#00D4FF" icon={<Users size={22} color="#00D4FF" />} title="Create your account" desc="Sign up in under a minute. Your role determines your agent access — researchers, lab managers, and admins all get a tailored experience." />
                <StepCard n={2} accent="#3B82F6" icon={<Brain size={22} color="#3B82F6" />} title="Connect to agents" desc="Browse the live agent network. Each agent is purpose-built for a specific domain — click to launch and start interacting immediately." />
                <StepCard n={3} accent="#34D399" icon={<Sparkles size={22} color="#34D399" />} title="Get instant results" desc="Ask questions, run analyses, book equipment, or generate reports. Every response is powered by state-of-the-art language models." />
              </div>
            </div>
          </section>

          {/* ── Features ── */}
          <section style={{ maxWidth: 1280, margin: "0 auto" }} className="section-pad2">
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 24, padding: "6px 16px", marginBottom: 16 }}>
                <Star size={12} color="#3B82F6" />
                <span style={{ fontSize: 12, color: "rgba(100,160,255,0.7)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Platform Features</span>
              </div>
              <h2 style={{ fontSize: "clamp(22px,3.5vw,34px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#E8F4FF" }}>Built for serious research</h2>
            </div>
            <div className="features-grid">
              {[
                { icon: <Zap size={22} color="#00D4FF" />,       accent: "#00D4FF", title: "Always Available",  sub: "24/7 Uptime",       desc: "Every agent runs continuously with zero downtime. Built for critical research environments that cannot afford interruption." },
                { icon: <Globe size={22} color="#A78BFA" />,      accent: "#A78BFA", title: "Multi-Modal Input", sub: "Voice + Text",       desc: "Seamlessly switch between voice and text. Dictate observations or type queries — the system adapts to your workflow." },
                { icon: <ShieldCheck size={22} color="#34D399" />, accent: "#34D399", title: "Enterprise Grade",  sub: "SOC 2 Ready",        desc: "Role-based access, audit trails, and data isolation. Designed to meet enterprise compliance from day one." },
                { icon: <Brain size={22} color="#F472B6" />,      accent: "#F472B6", title: "Context Aware",     sub: "Memory + History",   desc: "Agents remember your research context across sessions. No repetition — just deeper, more relevant interactions." },
                { icon: <Activity size={22} color="#F59E0B" />,   accent: "#F59E0B", title: "Real-time Data",    sub: "Live Analytics",     desc: "Dashboards and reports update as new data arrives. Stay current with your lab's performance and outcomes." },
                { icon: <Users size={22} color="#3B82F6" />,      accent: "#3B82F6", title: "Team Collaboration",sub: "Shared Workspaces",  desc: "Invite colleagues, share agent sessions, and co-author findings — collaboration built into every workflow." },
              ].map(f => (
                <div key={f.title}
                  style={{ background: "rgba(0,10,30,0.6)", border: "1px solid rgba(0,80,160,0.14)", borderRadius: 18, padding: "26px 22px", transition: "all 0.3s", cursor: "default" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = f.accent + "44"; (e.currentTarget as HTMLDivElement).style.background = "rgba(0,15,45,0.85)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,80,160,0.14)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(0,10,30,0.6)"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg,${f.accent}20,${f.accent}0a)`, border: `1px solid ${f.accent}33`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{f.icon}</div>
                  <div style={{ fontSize: 11, color: f.accent, marginBottom: 5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{f.sub}</div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: "#E8F4FF", marginBottom: 8 }}>{f.title}</h4>
                  <p style={{ fontSize: 13, color: "rgba(120,170,220,0.6)", lineHeight: 1.7 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Trust strip ── */}
          <section style={{ borderTop: "1px solid rgba(0,80,160,0.1)", background: "rgba(0,6,20,0.5)" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px" }}>
              <p style={{ textAlign: "center", fontSize: 12, color: "rgba(80,120,170,0.5)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 28 }}>Trusted capabilities</p>
              <div className="trust-grid">
                {[
                  { icon: <ShieldCheck size={20} color="#34D399" />, label: "SOC 2 Compliant",    color: "#34D399" },
                  { icon: <Lock size={20} color="#00D4FF" />,        label: "End-to-End Encrypted", color: "#00D4FF" },
                  { icon: <Globe size={20} color="#A78BFA" />,       label: "GDPR Ready",          color: "#A78BFA" },
                  { icon: <Activity size={20} color="#F59E0B" />,    label: "99.99% Uptime SLA",   color: "#F59E0B" },
                ].map(t => (
                  <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,10,30,0.5)", border: "1px solid rgba(0,60,130,0.12)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}12`, border: `1px solid ${t.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{t.icon}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(180,220,255,0.75)" }}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA banner (guests only) ── */}
          {!user && !authLoading && (
            <section style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 80px" }}>
              <div className="cta-section">
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "70%", height: "120%", background: "radial-gradient(ellipse,rgba(0,150,255,0.08) 0%,transparent 65%)", pointerEvents: "none", borderRadius: "50%" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 24, padding: "6px 16px", marginBottom: 20 }}>
                    <Sparkles size={12} color="#00D4FF" />
                    <span style={{ fontSize: 12, color: "rgba(0,212,255,0.7)", fontWeight: 600 }}>Free Access Available</span>
                  </div>
                  <h2 style={{ fontSize: "clamp(22px,4vw,40px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#E8F4FF", marginBottom: 14 }}>
                    Ready to accelerate your research?
                  </h2>
                  <p style={{ fontSize: "clamp(14px,1.8vw,16px)", color: "rgba(130,180,230,0.65)", maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.7 }}>
                    Join researchers and lab managers already using Life Science AI to streamline their workflows.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#fff", textDecoration: "none", padding: "14px 32px", borderRadius: 14, background: "linear-gradient(135deg,#0096FF,#3B82F6)", boxShadow: "0 8px 36px rgba(0,150,255,0.4)" }}>
                      Create Free Account <ArrowRight size={16} />
                    </Link>
                    <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "rgba(0,212,255,0.85)", textDecoration: "none", padding: "14px 32px", borderRadius: 14, border: "1px solid rgba(0,212,255,0.28)", background: "rgba(0,212,255,0.06)" }}>
                      Sign In
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Footer ── */}
          <footer style={{ borderTop: "1px solid rgba(0,60,130,0.12)", background: "rgba(0,5,18,0.6)" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "44px 24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32, marginBottom: 36 }}>
                {/* Brand */}
                <div style={{ maxWidth: 280 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Image src="/logo.png" alt="Life Science AI" width={30} height={30} style={{ objectFit: "contain" }} />
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.04em", background: "linear-gradient(135deg,#E8F4FF,#00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Life Science AI</span>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(100,150,200,0.55)", lineHeight: 1.7 }}>Next-generation AI agents built for the life sciences industry — research, scheduling, analysis, and more.</p>
                </div>
                {/* Links */}
                <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,212,255,0.45)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 14 }}>Platform</div>
                    {["Agents", "Features", "Pricing", "Status"].map(l => (
                      <div key={l} style={{ marginBottom: 8 }}><Link href="#" style={{ fontSize: 13, color: "rgba(140,185,230,0.55)", textDecoration: "none" }}>{l}</Link></div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,212,255,0.45)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 14 }}>Company</div>
                    {["About", "Blog", "Careers", "Contact"].map(l => (
                      <div key={l} style={{ marginBottom: 8 }}><Link href="#" style={{ fontSize: 13, color: "rgba(140,185,230,0.55)", textDecoration: "none" }}>{l}</Link></div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,212,255,0.45)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 14 }}>Legal</div>
                    {["Privacy", "Terms", "Security", "Compliance"].map(l => (
                      <div key={l} style={{ marginBottom: 8 }}><Link href="#" style={{ fontSize: 13, color: "rgba(140,185,230,0.55)", textDecoration: "none" }}>{l}</Link></div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Bottom bar */}
              <div style={{ borderTop: "1px solid rgba(0,60,130,0.12)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <span style={{ fontSize: 12, color: "rgba(60,100,150,0.45)" }}>© 2025 Life Science AI Intelligence Platform. All rights reserved.</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, background: "#00FF88", borderRadius: "50%", animation: "pulseDot 2s infinite", boxShadow: "0 0 6px #00FF88" }} />
                  <span style={{ fontSize: 12, color: "rgba(0,212,255,0.4)" }}>All systems operational</span>
                </div>
              </div>
            </div>
          </footer>

        </main>
      </div>
    </>
  );
}
