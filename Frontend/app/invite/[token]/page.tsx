'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Phone, Lock, Eye, EyeOff, CheckCircle, XCircle,
  Mail, AlertCircle, Loader2, ArrowRight,
} from 'lucide-react';
import { authApi } from '@/lib/api-client';
import { useCompleteInvite } from '@/lib/hooks/use-auth';

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
  { key: 'length',  label: '8+ chars'    },
  { key: 'upper',   label: 'Uppercase'   },
  { key: 'lower',   label: 'Lowercase'   },
  { key: 'digit',   label: 'Number'      },
  { key: 'special', label: 'Special char'},
] as const;

interface InviteInfo {
  email: string;
  invited_by: string;
  expires_at: string;
}

type TokenState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used';

export default function InviteSignupPage() {
  const params  = useParams();
  const router  = useRouter();
  const token   = params?.token as string;

  const [tokenState, setTokenState] = useState<TokenState>('loading');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', password: '', password_confirm: '',
  });
  const [showPwd, setShowPwd]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const completeInvite = useCompleteInvite();

  const rules         = validatePassword(form.password);
  const allRulesValid = Object.values(rules).every(Boolean);
  const pwdsMatch     = form.password === form.password_confirm && form.password_confirm !== '';
  const nameValid     = form.first_name.trim().length > 0 && form.last_name.trim().length > 0;
  const canSubmit     = nameValid && allRulesValid && pwdsMatch && !completeInvite.isPending;

  const errorData = (completeInvite.error as {
    response?: { data?: { error?: { message?: string; details?: Record<string, string[]> } } };
  })?.response?.data?.error;
  const fieldErrors: Record<string, string[]> = errorData?.details ?? {};
  const globalError = errorData?.message ?? '';

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenState('invalid'); return; }
    authApi.validateInviteToken(token)
      .then((info) => { setInviteInfo(info); setTokenState('valid'); })
      .catch((err) => {
        const msg: string = err?.response?.data?.error?.message ?? '';
        if (msg.includes('already been used')) setTokenState('used');
        else if (msg.includes('expired'))      setTokenState('expired');
        else                                   setTokenState('invalid');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !inviteInfo) return;

    try {
      await completeInvite.mutateAsync({
        token,
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        phone:      form.phone.trim(),
        password:   form.password,
        password_confirm: form.password_confirm,
      });
      setSubmitted(true);
      // Redirect to OTP verification with email in query
      setTimeout(() => router.push(`/verify-otp?email=${encodeURIComponent(inviteInfo.email)}`), 800);
    } catch (_) { /* error shown inline */ }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (tokenState === 'loading') {
    return (
      <div style={STYLES.page}>
        <style>{CSS}</style>
        <div style={{ ...STYLES.card, textAlign: 'center' }}>
          <Loader2 size={32} color="#00D4FF" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(140,190,240,0.7)', fontSize: 14 }}>Validating your invite link…</p>
        </div>
      </div>
    );
  }

  // ── Invalid / expired / used ─────────────────────────────────────────────────
  if (tokenState !== 'valid') {
    const messages: Record<string, { icon: string; title: string; body: string }> = {
      invalid: { icon: '🔗', title: 'Invalid invite link', body: 'This invite link is invalid. Please ask your administrator to send a new invitation.' },
      expired: { icon: '⏰', title: 'Invite link expired', body: 'This invite link has expired (links are valid for 72 hours). Please contact your administrator for a new invitation.' },
      used:    { icon: '✅', title: 'Already registered', body: 'This invite link has already been used. If you have an account, you can sign in below.' },
    };
    const m = messages[tokenState] ?? messages.invalid;
    return (
      <div style={STYLES.page}>
        <style>{CSS}</style>
        <div style={{ ...STYLES.card, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{m.icon}</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#E8F4FF', marginBottom: 10 }}>{m.title}</h2>
          <p style={{ color: 'rgba(120,170,220,0.65)', lineHeight: 1.7, marginBottom: 24, fontSize: 14 }}>{m.body}</p>
          <Link href="/login" style={STYLES.ctaBtn}>Go to Sign In <ArrowRight size={14} /></Link>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={STYLES.page}>
        <style>{CSS}</style>
        <div style={{ ...STYLES.card, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#E8F4FF', marginBottom: 10 }}>Check your email</h2>
          <p style={{ color: 'rgba(120,170,220,0.65)', lineHeight: 1.7, fontSize: 14 }}>
            We sent a 6-digit verification code to <strong style={{ color: '#00D4FF' }}>{inviteInfo?.email}</strong>.
            Redirecting to verification…
          </p>
        </div>
      </div>
    );
  }

  // ── Signup form ──────────────────────────────────────────────────────────────
  return (
    <div style={STYLES.page}>
      <style>{CSS}</style>
      <div style={STYLES.card}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,#E8F4FF,#00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 20 }}>
            Life Science AI
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#E8F4FF', marginBottom: 6, letterSpacing: '-0.04em' }}>
            Complete your account
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.6)' }}>
            Invited by <strong style={{ color: 'rgba(0,212,255,0.8)' }}>{inviteInfo?.invited_by}</strong>
          </p>
        </div>

        {/* Pre-filled email chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 10, padding: '10px 14px', marginBottom: 24 }}>
          <Mail size={14} color="rgba(0,212,255,0.6)" />
          <span style={{ fontSize: 13, color: 'rgba(0,212,255,0.8)', fontWeight: 600 }}>{inviteInfo?.email}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(0,212,255,0.4)' }}>pre-filled</span>
        </div>

        {globalError && (
          <div style={STYLES.errorBox}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={STYLES.label}>First Name</label>
              <div style={STYLES.inputWrap}>
                <User size={15} style={STYLES.icon} />
                <input style={STYLES.input} placeholder="John"
                  value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
              </div>
              {fieldErrors.first_name?.map((e, i) => <p key={i} style={STYLES.fieldErr}>{e}</p>)}
            </div>
            <div>
              <label style={STYLES.label}>Last Name</label>
              <div style={STYLES.inputWrap}>
                <User size={15} style={STYLES.icon} />
                <input style={STYLES.input} placeholder="Doe"
                  value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
              </div>
              {fieldErrors.last_name?.map((e, i) => <p key={i} style={STYLES.fieldErr}>{e}</p>)}
            </div>
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 16 }}>
            <label style={STYLES.label}>Phone Number <span style={{ color: 'rgba(120,170,220,0.4)', fontWeight: 400 }}>(optional)</span></label>
            <div style={STYLES.inputWrap}>
              <Phone size={15} style={STYLES.icon} />
              <input style={STYLES.input} type="tel" placeholder="+1 555 000 0000"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 16 }}>
            <label style={STYLES.label}>Password</label>
            <div style={STYLES.inputWrap}>
              <Lock size={15} style={STYLES.icon} />
              <input style={STYLES.input} type={showPwd ? 'text' : 'password'} placeholder="Create a strong password"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              <button type="button" onClick={() => setShowPwd(s => !s)} style={STYLES.eyeBtn}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {fieldErrors.password?.map((e, i) => <p key={i} style={STYLES.fieldErr}>{e}</p>)}
            {form.password && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {PWD_RULES.map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    {rules[key] ? <CheckCircle size={10} color="#00FF88" /> : <XCircle size={10} color="#FF5050" />}
                    <span style={{ color: rules[key] ? '#00FF88' : 'rgba(255,120,120,0.7)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div style={{ marginBottom: 24 }}>
            <label style={STYLES.label}>Confirm Password</label>
            <div style={STYLES.inputWrap}>
              <Lock size={15} style={STYLES.icon} />
              <input style={{ ...STYLES.input, borderColor: form.password_confirm && !pwdsMatch ? 'rgba(255,80,80,0.4)' : undefined }}
                type={showPwd ? 'text' : 'password'} placeholder="Repeat your password"
                value={form.password_confirm} onChange={e => setForm(f => ({ ...f, password_confirm: e.target.value }))} required />
            </div>
            {form.password_confirm && !pwdsMatch && <p style={STYLES.fieldErr}>Passwords do not match</p>}
            {fieldErrors.password_confirm?.map((e, i) => <p key={i} style={STYLES.fieldErr}>{e}</p>)}
          </div>

          <button type="submit" disabled={!canSubmit} style={{ ...STYLES.submitBtn, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {completeInvite.isPending
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Creating account…</>
              : <>Create Account &amp; Verify Email <ArrowRight size={16} /></>
            }
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'rgba(120,170,220,0.5)' }}>
          Already have an account? <Link href="/login" style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page:     { minHeight: '100vh', background: '#020B18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', sans-serif" },
  card:     { width: '100%', maxWidth: 480, background: 'rgba(0,15,40,0.92)', border: '1px solid rgba(0,100,200,0.22)', borderRadius: 20, padding: '40px 36px', backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  label:    { display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(160,200,240,0.7)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  inputWrap:{ position: 'relative' },
  icon:     { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,150,220,0.5)', pointerEvents: 'none' } as React.CSSProperties,
  input:    { width: '100%', background: 'rgba(0,20,50,0.8)', border: '1px solid rgba(0,100,180,0.3)', borderRadius: 10, padding: '11px 11px 11px 38px', fontSize: 14, color: '#E8F4FF', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' } as React.CSSProperties,
  eyeBtn:   { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,150,220,0.5)', display: 'flex', padding: 0 } as React.CSSProperties,
  fieldErr: { fontSize: 12, color: '#FF8080', marginTop: 4 },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#FF8080', marginBottom: 16 },
  submitBtn:{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', background: 'linear-gradient(135deg,#0096FF,#3B82F6)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(0,150,255,0.3)' },
  ctaBtn:   { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 24px', background: 'linear-gradient(135deg,#0096FF,#3B82F6)', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #020B18; font-family: 'Inter', sans-serif; }
  input::placeholder { color: rgba(100,150,200,0.4); }
  input:focus { border-color: rgba(0,212,255,0.5) !important; box-shadow: 0 0 0 3px rgba(0,212,255,0.1); }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
