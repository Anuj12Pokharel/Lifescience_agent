'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowRight, Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useVerifyOTP, useResendOTP } from '@/lib/hooks/use-auth';

export default function VerifyOTPPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const emailParam   = searchParams.get('email') ?? '';

  const [email, setEmail]       = useState(emailParam);
  const [digits, setDigits]     = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verified, setVerified]  = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const verifyOTP = useVerifyOTP();
  const resendOTP = useResendOTP();

  const code = digits.join('');
  const codeComplete = code.length === 6;

  const errorData = (verifyOTP.error as {
    response?: { data?: { error?: { message?: string; details?: Record<string, string[]> } } };
  })?.response?.data?.error;
  const codeError = errorData?.details?.otp_code?.[0] ?? errorData?.message ?? '';

  // Countdown timer for resend
  useEffect(() => {
    if (canResend) return;
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { setCanResend(true); clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [canResend]);

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (codeComplete && !verifyOTP.isPending && !verifyOTP.isSuccess) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleDigit = (i: number, val: string) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      inputs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleVerify = async () => {
    if (!codeComplete || !email || verifyOTP.isPending) return;
    try {
      await verifyOTP.mutateAsync({ email, otp_code: code });
      setVerified(true);
    } catch (_) { /* error shown inline */ }
  };

  const handleResend = async () => {
    if (!canResend || !email) return;
    setDigits(['', '', '', '', '', '']);
    setCountdown(60);
    setCanResend(false);
    inputs.current[0]?.focus();
    await resendOTP.mutateAsync({ email });
  };

  // ── Verified success ─────────────────────────────────────────────────────────
  if (verified || verifyOTP.isSuccess) {
    return (
      <div style={STYLES.page}>
        <style>{CSS}</style>
        <div style={{ ...STYLES.card, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={30} color="#00FF88" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 10 }}>Email Verified!</h2>
          <p style={{ color: 'rgba(120,170,220,0.65)', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            Your account is now active. You can sign in to access your AI agents.
          </p>
          <Link href="/login" style={STYLES.ctaBtn}>
            Go to Sign In <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  // ── OTP form ─────────────────────────────────────────────────────────────────
  return (
    <div style={STYLES.page}>
      <style>{CSS}</style>
      <div style={STYLES.card}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Mail size={26} color="#00D4FF" />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,#E8F4FF,#00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 14 }}>
            Life Science AI
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 8, letterSpacing: '-0.03em' }}>
            Verify your email
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.6)', lineHeight: 1.6 }}>
            We sent a 6-digit code to{' '}
            <strong style={{ color: 'rgba(0,212,255,0.85)' }}>{email || 'your email'}</strong>.
            Enter it below to activate your account.
          </p>
        </div>

        {/* Email field (editable if not pre-filled) */}
        {!emailParam && (
          <div style={{ marginBottom: 20 }}>
            <label style={STYLES.label}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={STYLES.icon as React.CSSProperties} />
              <input style={STYLES.input} type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
        )}

        {/* OTP digit boxes */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              style={{
                width: 52, height: 60, textAlign: 'center', fontSize: 24, fontWeight: 800,
                background: d ? 'rgba(0,212,255,0.08)' : 'rgba(0,20,50,0.8)',
                border: `2px solid ${d ? 'rgba(0,212,255,0.4)' : 'rgba(0,100,180,0.25)'}`,
                borderRadius: 12, color: '#E8F4FF', outline: 'none',
                transition: 'all 0.15s', caretColor: '#00D4FF',
                boxShadow: d ? '0 0 12px rgba(0,212,255,0.15)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {codeError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 8, padding: '9px 13px', fontSize: 13, color: '#FF8080', marginTop: 12, marginBottom: 4 }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} /> {codeError}
          </div>
        )}

        {/* Verify button */}
        <button
          type="button"
          onClick={handleVerify}
          disabled={!codeComplete || verifyOTP.isPending || !email}
          style={{ ...STYLES.submitBtn, marginTop: 20, opacity: (codeComplete && email) ? 1 : 0.45, cursor: (codeComplete && email) ? 'pointer' : 'not-allowed' }}
        >
          {verifyOTP.isPending
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Verifying…</>
            : <>Verify Email <ArrowRight size={16} /></>
          }
        </button>

        {/* Resend */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'rgba(120,170,220,0.5)', marginBottom: 8 }}>
            Didn't receive the code?
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend || resendOTP.isPending}
            style={{ background: 'none', border: 'none', cursor: canResend ? 'pointer' : 'default', color: canResend ? '#00D4FF' : 'rgba(100,150,200,0.4)', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} />
            {resendOTP.isPending ? 'Sending…' : canResend ? 'Resend Code' : `Resend in ${countdown}s`}
          </button>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'rgba(120,170,220,0.5)' }}>
          <Link href="/login" style={{ color: 'rgba(0,212,255,0.6)', textDecoration: 'none' }}>← Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page:     { minHeight: '100vh', background: '#020B18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', sans-serif" },
  card:     { width: '100%', maxWidth: 420, background: 'rgba(0,15,40,0.92)', border: '1px solid rgba(0,100,200,0.22)', borderRadius: 20, padding: '40px 36px', backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  label:    { display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(160,200,240,0.7)', marginBottom: 6, textTransform: 'uppercase' } as React.CSSProperties,
  icon:     { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,150,220,0.5)', pointerEvents: 'none' },
  input:    { width: '100%', background: 'rgba(0,20,50,0.8)', border: '1px solid rgba(0,100,180,0.3)', borderRadius: 10, padding: '11px 11px 11px 38px', fontSize: 14, color: '#E8F4FF', outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  submitBtn:{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', background: 'linear-gradient(135deg,#0096FF,#3B82F6)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 6px 24px rgba(0,150,255,0.3)' },
  ctaBtn:   { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 28px', background: 'linear-gradient(135deg,#0096FF,#3B82F6)', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #020B18; font-family: 'Inter', sans-serif; }
  input::placeholder { color: rgba(100,150,200,0.4); }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
