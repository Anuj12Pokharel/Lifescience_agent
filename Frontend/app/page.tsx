'use client';

import { useState, useEffect, useRef } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Zap, MessageSquare, Microscope, BookOpen, BarChart3,
  Clock, Users, Brain, ShieldCheck, LogOut, Bot, Lock,
  KeyRound, Eye, EyeOff, CheckCircle, XCircle, X,
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

function getAgentRoute(slug: string): string | null {
  return SLUG_ROUTES[slug] ?? null;
}

// ─── Static visual config per slug (icon + colour) ───────────────────────────
type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

interface SlugStyle { icon: IconComponent; accent: string; glow: string; }

const SLUG_STYLES: Record<string, SlugStyle> = {
  "inquiry-booking":        { icon: MessageSquare, accent: "#00D4FF", glow: "rgba(0,212,255,0.3)" },
  "project-tracking-agent": { icon: Microscope,    accent: "#3B82F6", glow: "rgba(59,130,246,0.3)" },
  "data-analyst":           { icon: BarChart3,     accent: "#06B6D4", glow: "rgba(6,182,212,0.3)"  },
  "data-security":          { icon: ShieldCheck,   accent: "#EF4444", glow: "rgba(239,68,68,0.3)"  },
  "protocol-expert":        { icon: BookOpen,      accent: "#818CF8", glow: "rgba(129,140,248,0.3)"},
  "knowledge-base":         { icon: Brain,         accent: "#A78BFA", glow: "rgba(167,139,250,0.3)"},
  "scheduler":              { icon: Clock,         accent: "#34D399", glow: "rgba(52,211,153,0.3)" },
  "collaboration-hub":      { icon: Users,         accent: "#F472B6", glow: "rgba(244,114,182,0.3)"},
};

const DEFAULT_STYLE: SlugStyle = { icon: Bot, accent: "#00D4FF", glow: "rgba(0,212,255,0.3)" };

function getStyle(slug: string): SlugStyle {
  return SLUG_STYLES[slug] ?? DEFAULT_STYLE;
}

// ─── Button label per slug ────────────────────────────────────────────────────
function getButtonLabel(slug: string): string {
  const labels: Record<string, string> = {
    "inquiry-booking":        "Initialise Chat",
    "project-tracking-agent": "Track Projects",
    "data-analyst":           "Analyze Data",
  };
  return labels[slug] ?? "Open Agent";
}


// ─── Neural canvas background ─────────────────────────────────────────────────
function NeuralGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let w = 0, h = 0;
    interface Node { x: number; y: number; vx: number; vy: number; r: number; pulse: number; }
    const nodes: Node[] = [];
    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 55; i++) {
      nodes.push({ x: Math.random() * (w || 800), y: Math.random() * (h || 400), vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, r: Math.random() * 1.5 + 0.5, pulse: Math.random() * Math.PI * 2 });
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      nodes.forEach(n => { n.x += n.vx; n.y += n.vy; n.pulse += 0.012; if (n.x < 0 || n.x > w) n.vx *= -1; if (n.y < 0 || n.y > h) n.vy *= -1; });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.strokeStyle = `rgba(0,180,255,${(1 - dist / 130) * 0.15})`; ctx.lineWidth = 0.5; ctx.stroke(); }
        }
      }
      nodes.forEach(n => { const p = (Math.sin(n.pulse) + 1) / 2; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + p * 1.2, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,212,255,${0.4 + p * 0.4})`; ctx.fill(); });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.6 }} />;
}

// ─── Password validation ──────────────────────────────────────────────────────
function validatePassword(pwd: string) {
  return {
    length:  pwd.length >= 8,
    upper:   /[A-Z]/.test(pwd),
    lower:   /[a-z]/.test(pwd),
    digit:   /\d/.test(pwd),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd),
  };
}
const PWD_RULES = [
  { key: 'length',  label: '8+ chars'     },
  { key: 'upper',   label: 'Uppercase'    },
  { key: 'lower',   label: 'Lowercase'    },
  { key: 'digit',   label: 'Number'       },
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

  const fieldErrors: Record<string, string[]> =
    (changePassword.error as { response?: { data?: { error?: { details?: Record<string, string[]> } } } })
      ?.response?.data?.error?.details ?? {};
  const globalError: string =
    (changePassword.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? '';

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(0,20,50,0.8)', border: '1px solid rgba(0,100,180,0.3)',
    borderRadius: 10, padding: '11px 40px', fontSize: 14, color: '#E8F4FF',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: 'rgba(0,15,40,0.98)', border: '1px solid rgba(0,100,200,0.25)', borderRadius: 18, padding: '28px 28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.7)', position: 'relative', margin: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(120,170,220,0.5)', padding: 4 }}>
          <X size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KeyRound size={16} color="#00D4FF" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#E8F4FF' }}>Change Password</div>
            <div style={{ fontSize: 12, color: 'rgba(120,170,220,0.5)' }}>Update your account password</div>
          </div>
        </div>

        {globalError && (
          <div style={{ background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#FF8080', marginBottom: 16 }}>{globalError}</div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); if (!allValid || !passwordsMatch) return; changePassword.mutate(form, { onSuccess: () => { setForm({ old_password: '', new_password: '', new_password_confirm: '' }); onClose(); } }); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Current password */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(160,200,240,0.7)', marginBottom: 6 }}>Current Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,150,220,0.5)', pointerEvents: 'none' }}><Lock size={15} /></span>
              <input style={inputStyle} type={showOld ? 'text' : 'password'} placeholder="Current password"
                value={form.old_password} onChange={(e) => setForm({ ...form, old_password: e.target.value })} required />
              <button type="button" onClick={() => setShowOld(!showOld)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,150,220,0.5)', display: 'flex' }}>
                {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {fieldErrors.old_password?.map((err, i) => <p key={i} style={{ fontSize: 12, color: '#FF8080', marginTop: 4 }}>{err}</p>)}
          </div>

          {/* New password */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(160,200,240,0.7)', marginBottom: 6 }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,150,220,0.5)', pointerEvents: 'none' }}><Lock size={15} /></span>
              <input style={inputStyle} type={showNew ? 'text' : 'password'} placeholder="New password"
                value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required />
              <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,150,220,0.5)', display: 'flex' }}>
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {form.new_password && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {PWD_RULES.map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    {rules[key] ? <CheckCircle size={11} color="#00FF88" /> : <XCircle size={11} color="#FF5050" />}
                    <span style={{ color: rules[key] ? '#00FF88' : 'rgba(255,120,120,0.7)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
            {fieldErrors.new_password?.map((err, i) => <p key={i} style={{ fontSize: 12, color: '#FF8080', marginTop: 4 }}>{err}</p>)}
          </div>

          {/* Confirm password */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(160,200,240,0.7)', marginBottom: 6 }}>Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,150,220,0.5)', pointerEvents: 'none' }}><Lock size={15} /></span>
              <input style={inputStyle} type={showNew ? 'text' : 'password'} placeholder="Repeat new password"
                value={form.new_password_confirm} onChange={(e) => setForm({ ...form, new_password_confirm: e.target.value })} required />
            </div>
            {form.new_password_confirm && !passwordsMatch && <p style={{ fontSize: 12, color: '#FF8080', marginTop: 4 }}>Passwords do not match</p>}
            {fieldErrors.new_password_confirm?.map((err, i) => <p key={i} style={{ fontSize: 12, color: '#FF8080', marginTop: 4 }}>{err}</p>)}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '10px 18px', background: 'rgba(0,100,200,0.1)', border: '1px solid rgba(0,100,200,0.2)', borderRadius: 10, color: 'rgba(160,200,240,0.6)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button type="submit" disabled={changePassword.isPending || !allValid || !passwordsMatch || !form.old_password}
              style={{ padding: '10px 18px', background: 'linear-gradient(135deg,rgba(0,150,255,0.3),rgba(0,100,200,0.2))', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 10, color: '#00D4FF', cursor: changePassword.isPending || !allValid || !passwordsMatch || !form.old_password ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: changePassword.isPending || !allValid || !passwordsMatch || !form.old_password ? 0.6 : 1 }}>
              {changePassword.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── User avatar + popover ────────────────────────────────────────────────────
function UserAvatarMenu({ email, role, onLogout, logoutPending }: {
  email: string; role: string; onLogout: () => void; logoutPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = email[0].toUpperCase();
  const isAdmin = role === 'superadmin' || role === 'admin';

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        {/* Avatar button */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="User menu"
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg,rgba(0,150,255,0.35),rgba(0,80,200,0.25))',
            border: `2px solid ${open ? 'rgba(0,212,255,0.6)' : 'rgba(0,212,255,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: '#00D4FF',
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: open ? '0 0 16px rgba(0,212,255,0.3)' : 'none',
          }}>
          {initial}
        </button>

        {/* Popover */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            width: 220, background: 'rgba(0,15,40,0.98)',
            border: '1px solid rgba(0,100,200,0.25)', borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            overflow: 'hidden', zIndex: 400,
            animation: 'fadeSlideUp 0.15s ease both',
          }}>
            {/* User info */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,100,200,0.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(0,150,255,0.3),rgba(0,80,200,0.2))', border: '1px solid rgba(0,212,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#00D4FF', flexShrink: 0 }}>
                  {initial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E8F4FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                  <div style={{ fontSize: 11, color: isAdmin ? '#F59E0B' : 'rgba(0,212,255,0.6)', fontWeight: 500, marginTop: 1 }}>
                    {isAdmin ? '🔐 Admin' : 'User'}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div style={{ padding: '6px 0' }}>
              {isAdmin && (
                <Link href="/admin/dashboard" onClick={() => setOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: 'rgba(245,158,11,0.85)', textDecoration: 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <ShieldCheck size={15} />
                  Admin Panel
                </Link>
              )}

              <button onClick={() => { setOpen(false); setShowChangePwd(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, color: 'rgba(160,200,240,0.8)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,100,200,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <KeyRound size={15} />
                Change Password
              </button>

              <div style={{ height: 1, background: 'rgba(0,100,200,0.1)', margin: '4px 0' }} />

              <button onClick={() => { setOpen(false); onLogout(); }}
                disabled={logoutPending}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', fontSize: 13, color: 'rgba(255,100,100,0.75)', cursor: logoutPending ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: logoutPending ? 0.6 : 1, transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,80,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <LogOut size={15} />
                {logoutPending ? 'Signing out…' : 'Sign Out'}
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
  const { icon: Icon, accent, glow } = getStyle(agent.slug);
  const hasAccess  = agent.has_access === true;
  const isLive     = agent.status === 'live';
  const isInactive = agent.is_active === false;

  const handleClick = () => {
    if (!isLoggedIn) { router.push('/login'); return; }
    if (!hasAccess) { setNoAccess(true); setTimeout(() => setNoAccess(false), 3000); return; }
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
        background: hovered ? "linear-gradient(135deg,rgba(0,15,40,0.95),rgba(0,25,60,0.95))" : "rgba(0,10,30,0.8)",
        border: `1px solid ${hovered ? accent + "66" : "rgba(0,100,180,0.2)"}`,
        borderRadius: "16px", padding: "24px", cursor: "pointer",
        transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        transform: hovered && hasAccess ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered && hasAccess ? `0 20px 60px ${glow},inset 0 1px 0 rgba(255,255,255,0.05)` : "0 4px 20px rgba(0,0,0,0.4)",
        backdropFilter: "blur(16px)", position: "relative", overflow: "hidden",
        animationDelay: `${index * 80}ms`, animation: "fadeSlideUp 0.6s ease both",
      }}
    >
      <div style={{ position: "absolute", top: "-30px", left: "-20px", width: "120px", height: "120px", background: `radial-gradient(circle,${accent}22 0%,transparent 70%)`, borderRadius: "50%", opacity: hovered ? 1 : 0, transition: "opacity 0.4s", pointerEvents: "none" }} />
      {hovered && isFeatured && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,transparent 0%,${accent}08 50%,transparent 100%)`, animation: "scanLine 1.5s linear infinite", pointerEvents: "none" }} />}

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ width: "48px", height: "48px", background: `linear-gradient(135deg,${accent}33,${accent}11)`, border: `1px solid ${accent}44`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s", transform: hovered ? "scale(1.1) rotate(-3deg)" : "scale(1)", boxShadow: hovered ? `0 0 20px ${accent}44` : "none", flexShrink: 0 }}>
            <Icon size={22} color={accent} />
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: isInactive ? "rgba(255,40,50,0.07)" : isLive ? "rgba(0,255,120,0.08)" : "rgba(255,50,70,0.05)",
            border: `1px solid ${isInactive ? "rgba(255,40,50,0.3)" : isLive ? "rgba(0,255,120,0.2)" : "rgba(255,50,70,0.15)"}`,
            borderRadius: "20px", padding: "4px 10px", flexShrink: 0
          }}>
            <div style={{ width: "6px", height: "6px", background: isInactive ? "#FF3040" : isLive ? "#00FF88" : "#FF3C50", borderRadius: "50%", animation: isLive && !isInactive ? "pulseGreen 2s infinite" : "none", boxShadow: isLive && !isInactive ? "0 0 6px #00FF88" : "none" }} />
            <span style={{ fontSize: "11px", color: isInactive ? "#FF3040" : isLive ? "#00FF88" : "#FF3C50", fontWeight: 600 }}>
              {isInactive ? "Inactive" : isLive ? "Live" : agent.status ?? "Offline"}
            </span>
          </div>
        </div>

        {/* Info */}
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#E8F4FF", marginBottom: "4px" }}>{agent.name}</h3>
        <p style={{ fontSize: "12px", color: accent, marginBottom: "10px", fontWeight: "500" }}>{agent.subtitle ?? ""}</p>
        <p style={{ fontSize: "13px", color: "rgba(160,200,240,0.7)", marginBottom: "16px", lineHeight: "1.6" }}>{agent.description ?? ""}</p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", background: "rgba(0,20,50,0.6)", border: "1px solid rgba(0,100,200,0.15)", borderRadius: "10px", padding: "10px", marginBottom: "16px" }}>
          {[
            { label: "Status",     value: agent.status ?? "—"              },
            { label: "Latency",    value: agent.latency ?? "—"              },
            { label: "Efficiency", value: agent.efficiency != null ? `${agent.efficiency}%` : "—" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "rgba(100,150,200,0.6)", marginBottom: "3px" }}>{stat.label}</div>
              <div style={{ fontSize: "12px", fontWeight: "700", color: accent }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Efficiency bar */}
        {agent.efficiency != null && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ height: "3px", background: "rgba(0,100,200,0.2)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${agent.efficiency}%`, background: `linear-gradient(90deg,${accent}88,${accent})`, borderRadius: "2px", boxShadow: `0 0 8px ${accent}88` }} />
            </div>
          </div>
        )}

        {/* No-access flash */}
        {noAccess && (
          <div style={{ marginBottom: "10px", padding: "8px 12px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: "8px", fontSize: "12px", color: "#FF8080", textAlign: "center" }}>
            You don&apos;t have access to this agent
          </div>
        )}

        {/* CTA button */}
        <button
          onClick={handleClick}
          style={{
            width: "100%", padding: "10px 16px",
            background: hasAccess
              ? (hovered ? `linear-gradient(135deg,${accent}22,${accent}11)` : "rgba(0,100,200,0.12)")
              : "rgba(255,255,255,0.02)",
            border: `1px solid ${hasAccess ? (hovered ? accent + "55" : "rgba(0,100,200,0.25)") : "rgba(255,255,255,0.05)"}`,
            borderRadius: "10px",
            color: hasAccess ? (hovered ? accent : "#80B4E0") : "rgba(128,180,224,0.35)",
            fontSize: "13px", fontWeight: "600",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.3s"
          }}>
          {hasAccess
            ? <MessageSquare size={14} />
            : <Lock size={14} style={{ opacity: 0.4 }} />
          }
          {hasAccess ? getButtonLabel(agent.slug) : (isLoggedIn ? "No Access" : "Sign In")}
          {hasAccess && (
            <ArrowRight size={14} style={{ marginLeft: "auto", opacity: hovered ? 1 : 0, transform: hovered ? "translateX(0)" : "translateX(-4px)", transition: "all 0.3s" }} />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton card while loading ─────────────────────────────────────────────
function SkeletonCard({ isFeatured }: { isFeatured: boolean }) {
  return (
    <div
      className={`agent-card agent-card--${isFeatured ? "featured" : "normal"}`}
      style={{ background: "rgba(0,10,30,0.6)", border: "1px solid rgba(0,100,180,0.1)", borderRadius: "16px", padding: "24px", animation: "fadeSlideUp 0.6s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(0,100,200,0.1)" }} />
        <div style={{ width: 60, height: 24, borderRadius: 20, background: "rgba(0,100,200,0.08)" }} />
      </div>
      {[120, 80, "100%", "100%", "100%"].map((w, i) => (
        <div key={i} style={{ height: i < 2 ? 14 : 10, width: w, background: "rgba(0,100,200,0.08)", borderRadius: 4, marginBottom: 10 }} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [tick, setTick] = useState(0);
  const { user, loading: authLoading } = useAuth();
  const logout = useLogout();

  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';

  // Admins get all agents (including inactive); others get the public list
  const { data: publicData, isLoading: publicLoading } = usePublicAgents();
  const { data: adminData, isLoading: adminLoading }   = useAgents({}, isAdmin);
  const agentsLoading = isAdmin ? adminLoading : publicLoading;
  const agents = isAdmin ? (adminData?.results ?? []) : (publicData?.results ?? []);

  const liveCount  = agents.filter(a => a.status === 'live').length;
  const totalCount = agents.length;
  const statusItems = agentsLoading
    ? [{ label: "Loading", value: "…" }]
    : [
        { label: "Neural Networks", value: liveCount > 0 ? "Online" : "Standby" },
        { label: "Models Loaded",   value: `${liveCount}/${totalCount}`           },
        { label: "API Latency",     value: "12ms"                                 },
        { label: "Uptime",          value: "99.99%"                               },
      ];

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 2000); return () => clearInterval(id); }, []);

  const accessibleCount = agents.filter(a => a.has_access).length;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Life Science AI",
    "applicationCategory": "ScienceApplication",
    "operatingSystem": "Web Browser",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "featureList": ["AI-powered research assistance", "Laboratory booking system", "Voice and text interaction", "Multi-modal input support", "Real-time collaboration", "Enterprise-grade security"],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #020B18; font-family: 'Inter', sans-serif; }

        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGreen { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        @keyframes scanLine { 0% { transform: translateY(-100%); } 100% { transform: translateY(200%); } }
        @keyframes floatOrb { 0%, 100% { transform: translateY(0) translateX(0); } 33% { transform: translateY(-20px) translateX(10px); } 66% { transform: translateY(10px) translateX(-15px); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #020B18; }
        ::-webkit-scrollbar-thumb { background: #0A3060; border-radius: 3px; }

        .page-root { min-height: 100vh; background: #020B18; font-family: 'Inter', sans-serif; color: #E8F4FF; overflow-x: hidden; }

        .agent-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .agent-card--featured { grid-column: span 2; }
        .agent-card--normal  { grid-column: span 1; }

        @media (max-width: 900px) {
          .agent-grid { grid-template-columns: repeat(2, 1fr); }
          .agent-card--featured { grid-column: span 2; }
          .agent-card--normal  { grid-column: span 1; }
        }
        @media (max-width: 520px) {
          .agent-grid { grid-template-columns: 1fr; }
          .agent-card--featured { grid-column: span 1; }
          .agent-card--normal  { grid-column: span 1; }
        }

        .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 900px) { .features-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 520px) { .features-grid { grid-template-columns: 1fr; } }

        .stats-row { display: flex; align-items: center; justify-content: center; gap: 48px; flex-wrap: wrap; margin-bottom: 16px; }
        @media (max-width: 520px) { .stats-row { gap: 24px; } }

        .hero-section { padding: 80px 24px 64px; }
        @media (max-width: 768px) { .hero-section { padding: 56px 16px 48px; } }
        @media (max-width: 520px) { .hero-section { padding: 40px 16px 36px; } }

        .section-pad { padding: 0 24px 80px; }
        @media (max-width: 520px) { .section-pad { padding: 0 12px 48px; } }

        .features-pad { padding: 48px 24px; }
        @media (max-width: 520px) { .features-pad { padding: 32px 16px; } }

        .status-badge-text { font-size: 12px; color: rgba(0,212,255,0.8); white-space: nowrap; }
        @media (max-width: 400px) { .status-badge-text { display: none; } }

        .logo-subtitle { font-size: 11px; color: rgba(0,212,255,0.6); }
        @media (max-width: 360px) { .logo-subtitle { display: none; } }

      `}</style>

      <div className="page-root">

        {/* Ambient orbs */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{ position: "absolute", top: "10%", left: "15%", width: "clamp(200px,40vw,600px)", height: "clamp(200px,40vw,600px)", background: "radial-gradient(circle,rgba(0,80,200,0.12) 0%,transparent 60%)", animation: "floatOrb 12s ease-in-out infinite", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: "15%", right: "10%", width: "clamp(160px,35vw,500px)", height: "clamp(160px,35vw,500px)", background: "radial-gradient(circle,rgba(0,180,255,0.08) 0%,transparent 60%)", animation: "floatOrb 16s ease-in-out infinite reverse", borderRadius: "50%" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "clamp(300px,60vw,800px)", height: "clamp(300px,60vw,800px)", background: "radial-gradient(circle,rgba(0,40,120,0.1) 0%,transparent 60%)", borderRadius: "50%" }} />
        </div>

        {/* Header */}
        <header style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid rgba(0,100,200,0.15)", background: "rgba(2,11,24,0.85)", backdropFilter: "blur(20px)" }} role="banner">
          <nav style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }} aria-label="Main navigation">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, minWidth: 0 }}>
              <Image src="/logo.png" alt="Life Science AI Logo" width={36} height={36} style={{ objectFit: 'contain', flexShrink: 0 }} priority />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "clamp(14px,3.5vw,18px)", fontWeight: "800", letterSpacing: "-0.04em", background: "linear-gradient(135deg,#E8F4FF,#00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "nowrap" }}>Life Science AI</div>
                <div className="logo-subtitle">Future intelligence</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "20px", padding: "6px 12px", flexShrink: 0 }}>
              <div style={{ width: "7px", height: "7px", background: "#00FF88", borderRadius: "50%", animation: "pulseDot 2s infinite", boxShadow: "0 0 8px #00FF88", flexShrink: 0 }} />
              <span className="status-badge-text">{statusItems[tick % statusItems.length].label}: {statusItems[tick % statusItems.length].value}</span>
            </div>

            {!authLoading && (
              user ? (
                <UserAvatarMenu
                  email={user.email}
                  role={user.role}
                  onLogout={() => logout.mutate()}
                  logoutPending={logout.isPending}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <Link href="/login" style={{ fontSize: "13px", fontWeight: "600", color: "rgba(0,212,255,0.8)", textDecoration: "none", padding: "6px 14px", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "20px", background: "rgba(0,212,255,0.05)", transition: "all 0.2s", whiteSpace: "nowrap" }}>Sign In</Link>
                  <Link href="/register" style={{ fontSize: "13px", fontWeight: "600", color: "#020B18", textDecoration: "none", padding: "6px 14px", borderRadius: "20px", background: "linear-gradient(135deg,#00D4FF,#3B82F6)", whiteSpace: "nowrap" }}>Register</Link>
                </div>
              )
            )}
          </nav>
        </header>

        <main style={{ position: "relative", zIndex: 1 }}>

          {/* Hero */}
          <section className="hero-section" style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", textAlign: "center", overflow: "hidden" }} role="main">
            <NeuralGrid />
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "30px", padding: "8px 18px", marginBottom: "28px", flexWrap: "wrap", justifyContent: "center" }}>
                <Zap size={13} color="#00D4FF" />
                <span style={{ fontSize: "13px", color: "#00D4FF" }}>Powered by Advanced AI</span>
                <div style={{ width: "1px", height: "12px", background: "rgba(0,212,255,0.3)", margin: "0 4px" }} />
                <span style={{ fontSize: "12px", color: "rgba(0,212,255,0.5)" }}>v3.1.0</span>
              </div>

              <h1 style={{ fontSize: "clamp(32px,6vw,72px)", fontWeight: "800", letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: "16px", background: "linear-gradient(135deg,#FFFFFF 0%,#A8D4FF 40%,#00D4FF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Life Science AI
              </h1>

              <p style={{ fontSize: "clamp(14px,2vw,17px)", color: "rgba(140,190,240,0.75)", maxWidth: "560px", margin: "0 auto 40px", lineHeight: "1.7", padding: "0 8px" }}>
                Seven specialised AI agents engineered for life science research, inquiry management, and intelligent scheduling — always online, always instant.
                {user
                  ? `Welcome back, ${user.email.split('@')[0]}. Your agents are ready.`
                  : "Specialized AI agents engineered for life science research, inquiry management, and intelligent scheduling — always online, always instant."}
              </p>

              <div className="stats-row">
                {[
                  { label: "Active Agents", value: agentsLoading ? "…" : user ? String(accessibleCount) : String(agents.length) },
                  { label: "Uptime SLA",    value: "99.99%" },
                  { label: "Avg Response",  value: "< 3s"   },
                  { label: "Availability",  value: "24/7"   },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: "800", letterSpacing: "-0.04em", background: "linear-gradient(135deg,#00D4FF,#3B82F6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.value}</div>
                    <div style={{ fontSize: "12px", color: "rgba(100,150,200,0.6)", marginTop: "4px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {!user && (
                <p style={{ fontSize: "12px", color: "rgba(0,212,255,0.4)", marginTop: "8px" }}>
                  Sign in to see your agent access
                </p>
              )}
            </div>
          </section>

          {/* Divider */}
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,transparent,rgba(0,100,200,0.3))" }} />
            <span style={{ fontSize: "12px", color: "rgba(0,212,255,0.5)", whiteSpace: "nowrap" }}>Agent Network — Online</span>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,rgba(0,100,200,0.3),transparent)" }} />
          </div>

          {/* Agent Grid */}
          <section style={{ maxWidth: "1280px", margin: "0 auto" }} className="section-pad">
            <div className="agent-grid">
              {agentsLoading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} isFeatured={i === 0} />)
                : agents.map((agent, i) => (
                    <AgentCard key={agent.id} agent={agent} index={i} isFeatured={i === 0} isLoggedIn={Boolean(user)} />
                  ))
              }
            </div>
          </section>

          {/* Features */}
          <section style={{ borderTop: "1px solid rgba(0,100,200,0.15)", background: "rgba(0,10,30,0.5)", backdropFilter: "blur(10px)" }}>
            <div style={{ maxWidth: "1280px", margin: "0 auto" }} className="features-pad">
              <div className="features-grid">
                {[
                  { icon: "⚡", title: "Always Available", sub: "24/7 Availability", desc: "Every agent runs continuously with zero downtime. Built for critical research environments that cannot afford interruption." },
                  { icon: "🎤", title: "Multi-Modal Input", sub: "Voice + Text", desc: "Seamlessly switch between voice and text. Dictate observations or type queries — system adapts to your workflow." },
                  { icon: "🔒", title: "Enterprise Grade", sub: "SOC 2 Ready", desc: "Designed with enterprise compliance in mind. Role-based access, audit trails, and data isolation for your team." },
                ].map(f => (
                  <div key={f.title} style={{ background: "rgba(0,15,40,0.6)", border: "1px solid rgba(0,100,200,0.15)", borderRadius: "16px", padding: "28px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "12px" }}>{f.icon}</div>
                    <div style={{ fontSize: "12px", color: "rgba(0,212,255,0.5)", marginBottom: "6px" }}>{f.sub}</div>
                    <h4 style={{ fontSize: "17px", fontWeight: "700", color: "#E8F4FF", marginBottom: "10px" }}>{f.title}</h4>
                    <p style={{ fontSize: "13px", color: "rgba(120,170,220,0.65)", lineHeight: "1.7" }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer style={{ borderTop: "1px solid rgba(0,100,200,0.1)", padding: "24px", textAlign: "center" }}>
            <span style={{ fontSize: "12px", color: "rgba(60,100,150,0.5)"}}>2025 Life Science AI Intelligence Platform</span>
          </footer>
        </main>
      </div>
    </>
  );
}
