'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, Building2, CheckCircle, XCircle } from 'lucide-react';
import { useRegisterAdmin } from '@/lib/hooks/use-auth';

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

export default function RegisterPage() {
  const registerAdmin = useRegisterAdmin();

  const [form, setForm] = useState({ email: '', password: '', password_confirm: '', organization_name: '' });
  const [showPassword, setShowPassword] = useState(false);

  const rules = validatePassword(form.password);
  const allValid = Object.values(rules).every(Boolean);
  const passwordsMatch = form.password === form.password_confirm && form.password_confirm !== '';

  const errorData = (registerAdmin.error as {
    response?: { data?: { error?: { message?: string; details?: Record<string, string[]> } } };
  })?.response?.data?.error;

  const fieldErrors: Record<string, string[]> = errorData?.details ?? {};
  const globalError: string = errorData && !errorData.details ? (errorData.message ?? '') : '';

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!allValid || !passwordsMatch || !form.organization_name.trim()) return;
    registerAdmin.mutate({
      email: form.email,
      password: form.password,
      password_confirm: form.password_confirm,
      organization_name: form.organization_name,
    });
  };

  if (registerAdmin.isSuccess) {
    return (
      <div className="auth-page">
        <style>{AUTH_STYLES}</style>
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#E8F4FF', marginBottom: '8px' }}>Check your email</h2>
          <p style={{ color: 'rgba(120,170,220,0.7)', marginBottom: '24px', lineHeight: 1.6 }}>
            We sent a verification link to <strong style={{ color: '#00D4FF' }}>{form.email}</strong>.
          </p>
          <Link href="/login" style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'none' }}>Back to Login →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <style>{AUTH_STYLES}</style>
      <div className="auth-card">
        <div className="logo-header">
          <div className="logo-header-title">Life Science AI</div>
        </div>

        <h1 className="auth-title">Create Admin Account</h1>
        <p className="auth-subtitle">Register your organization on the platform</p>

        <div className="invite-notice">
          <span className="invite-notice-icon">🔒</span>
          <span>Users join by invitation only. Admins register here.</span>
        </div>

        {globalError && <div className="error-box">{globalError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={16} /></span>
              <input className="form-input" type="email" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            {fieldErrors.email?.map((err, i) => <p key={i} className="field-error">{err}</p>)}
          </div>

          <div className="form-group">
            <label className="form-label">Organization Name</label>
            <div className="input-wrapper">
              <span className="input-icon"><Building2 size={16} /></span>
              <input
                className="form-input"
                type="text"
                placeholder="Acme Corp"
                value={form.organization_name}
                onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                required
              />
            </div>
            {fieldErrors.organization_name?.map((err, i) => <p key={i} className="field-error">{err}</p>)}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input className="form-input" type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <button type="button" className="input-suffix-btn" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password?.map((err, i) => <p key={i} className="field-error">{err}</p>)}

            {form.password && (
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
            <label className="form-label">Confirm Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input className="form-input" type={showPassword ? 'text' : 'password'}
                placeholder="Repeat your password" value={form.password_confirm}
                onChange={(e) => setForm({ ...form, password_confirm: e.target.value })} required
                style={{ borderColor: form.password_confirm && !passwordsMatch ? 'rgba(255,80,80,0.4)' : undefined }} />
            </div>
            {fieldErrors.password_confirm?.map((err, i) => <p key={i} className="field-error">{err}</p>)}
            {form.password_confirm && !passwordsMatch && <p className="field-error">Passwords do not match</p>}
          </div>

          <button type="submit" className="submit-btn"
            disabled={registerAdmin.isPending || !allValid || !passwordsMatch || !form.organization_name.trim()}>
            {registerAdmin.isPending ? 'Creating account...' : 'Create Admin Account'}
          </button>
        </form>

        <div className="auth-links">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

const AUTH_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .auth-page { min-height: 100vh; background: #020B18; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Inter', sans-serif; }
  .auth-card { width: 100%; max-width: 440px; background: rgba(0,15,40,0.9); border: 1px solid rgba(0,100,200,0.25); border-radius: 20px; padding: 40px; backdrop-filter: blur(20px); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .auth-title { font-size: 26px; font-weight: 800; color: #E8F4FF; margin-bottom: 4px; letter-spacing: -0.03em; }
  .auth-subtitle { font-size: 14px; color: rgba(120,170,220,0.6); margin-bottom: 20px; }
  .invite-notice { display: flex; align-items: center; gap: 8px; background: rgba(0,100,255,0.06); border: 1px solid rgba(0,150,255,0.18); border-radius: 9px; padding: 10px 14px; font-size: 13px; color: rgba(120,180,240,0.75); margin-bottom: 22px; }
  .invite-notice-icon { font-size: 15px; flex-shrink: 0; }
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
  .auth-links { margin-top: 24px; text-align: center; font-size: 13px; color: rgba(120,170,220,0.5); }
  .auth-links a { color: #00D4FF; text-decoration: none; font-weight: 600; }
  .logo-header { text-align: center; margin-bottom: 28px; }
  .logo-header-title { font-size: 18px; font-weight: 800; background: linear-gradient(135deg,#E8F4FF,#00D4FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
`;
