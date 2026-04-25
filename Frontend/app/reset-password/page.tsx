'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';
import { useResetPassword } from '@/lib/hooks/use-auth';

function validatePassword(pwd: string) {
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /\d/.test(pwd),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd),
  };
}

const PASSWORD_RULES = [
  { key: 'length', label: '8+ chars' },
  { key: 'upper', label: 'Uppercase' },
  { key: 'lower', label: 'Lowercase' },
  { key: 'digit', label: 'Number' },
  { key: 'special', label: 'Special char' },
] as const;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';

  const resetPassword = useResetPassword();
  const [form, setForm] = useState({ new_password: '', new_password_confirm: '' });
  const [showPassword, setShowPassword] = useState(false);

  const rules = validatePassword(form.new_password);
  const allValid = Object.values(rules).every(Boolean);
  const passwordsMatch = form.new_password === form.new_password_confirm && form.new_password_confirm !== '';

  const fieldErrors: Record<string, string[]> =
    (resetPassword.error as { response?: { data?: { error?: { details?: Record<string, string[]> } } } })
      ?.response?.data?.error?.details ?? {};
  const globalError: string =
    (resetPassword.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? '';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!uid || !token || !allValid || !passwordsMatch) return;
    resetPassword.mutate({ uid, token, ...form });
  };

  return (
    <div className="auth-page">
      <style>{AUTH_STYLES}</style>
      <div className="auth-card">
        <div className="logo-header">
          <div className="logo-header-title">Life Science AI</div>
        </div>

        <h1 className="auth-title">New password</h1>
        <p className="auth-subtitle">Enter your new secure password</p>

        {(!uid || !token) && (
          <div className="error-box">Invalid reset link — missing parameters.</div>
        )}
        {globalError && <div className="error-box">{globalError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input className="form-input" type={showPassword ? 'text' : 'password'}
                placeholder="New strong password" value={form.new_password}
                onChange={(e) => setForm({ ...form, new_password: e.target.value })} required />
              <button type="button" className="input-suffix-btn" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.new_password?.map((err, i) => <p key={i} className="field-error">{err}</p>)}

            {form.new_password && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {PASSWORD_RULES.map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    {rules[key] ? <CheckCircle size={12} color="#00FF88" /> : <XCircle size={12} color="#FF5050" />}
                    <span style={{ color: rules[key] ? '#00FF88' : 'rgba(255,120,120,0.7)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input className="form-input" type={showPassword ? 'text' : 'password'}
                placeholder="Repeat new password" value={form.new_password_confirm}
                onChange={(e) => setForm({ ...form, new_password_confirm: e.target.value })} required />
            </div>
            {fieldErrors.new_password_confirm?.map((err, i) => <p key={i} className="field-error">{err}</p>)}
            {form.new_password_confirm && !passwordsMatch && (
              <p className="field-error">Passwords do not match</p>
            )}
          </div>

          <button type="submit" className="submit-btn"
            disabled={resetPassword.isPending || !allValid || !passwordsMatch || !uid || !token}>
            {resetPassword.isPending ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link href="/login" style={{ fontSize: 13, color: '#00D4FF', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ background: '#020B18', minHeight: '100vh' }} />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

const AUTH_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .auth-page { min-height: 100vh; background: #020B18; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Inter', sans-serif; }
  .auth-card { width: 100%; max-width: 440px; background: rgba(0,15,40,0.9); border: 1px solid rgba(0,100,200,0.25); border-radius: 20px; padding: 40px; backdrop-filter: blur(20px); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .auth-title { font-size: 26px; font-weight: 800; color: #E8F4FF; margin-bottom: 4px; letter-spacing: -0.03em; }
  .auth-subtitle { font-size: 14px; color: rgba(120,170,220,0.6); margin-bottom: 32px; }
  .form-group { margin-bottom: 20px; }
  .form-label { display: block; font-size: 13px; font-weight: 600; color: rgba(160,200,240,0.8); margin-bottom: 8px; }
  .input-wrapper { position: relative; }
  .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(0,150,220,0.5); pointer-events: none; }
  .form-input { width: 100%; background: rgba(0,20,50,0.8); border: 1px solid rgba(0,100,180,0.3); border-radius: 10px; padding: 12px 40px; font-size: 14px; color: #E8F4FF; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
  .form-input:focus { border-color: rgba(0,212,255,0.5); box-shadow: 0 0 0 3px rgba(0,212,255,0.1); }
  .form-input::placeholder { color: rgba(100,150,200,0.4); }
  .input-suffix-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(0,150,220,0.5); padding: 0; display: flex; }
  .submit-btn { width: 100%; padding: 13px; background: linear-gradient(135deg,rgba(0,150,255,0.3),rgba(0,100,200,0.2)); border: 1px solid rgba(0,212,255,0.3); border-radius: 10px; color: #00D4FF; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .error-box { background: rgba(255,50,50,0.08); border: 1px solid rgba(255,50,50,0.2); border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #FF8080; margin-bottom: 20px; }
  .field-error { font-size: 12px; color: #FF8080; margin-top: 4px; }
  .logo-header { text-align: center; margin-bottom: 28px; }
  .logo-header-title { font-size: 18px; font-weight: 800; background: linear-gradient(135deg,#E8F4FF,#00D4FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
`;
