'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useLogin } from '@/lib/hooks/use-auth';

export default function LoginPage() {
  const login = useLogin();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const errorMsg: string =
    (login.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? '';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    login.mutate(form);
  };

  return (
    <div className="auth-page">
      <style>{AUTH_STYLES}</style>

      <div className="auth-card">
        <div className="logo-header">
          <div className="logo-header-title">Life Science AI</div>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        {errorMsg && <div className="error-box">{errorMsg}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={16} /></span>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />
              <button type="button" className="input-suffix-btn" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '-12px', marginBottom: '20px' }}>
            <Link href="/forgot-password" style={{ fontSize: '13px', color: '#00D4FF', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="submit-btn" disabled={login.isPending}>
            {login.isPending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-links">
          Don&apos;t have an account? <Link href="/register">Create one</Link>
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
  .submit-btn:hover:not(:disabled) { background: linear-gradient(135deg,rgba(0,180,255,0.4),rgba(0,130,220,0.3)); box-shadow: 0 0 20px rgba(0,212,255,0.2); }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .error-box { background: rgba(255,50,50,0.08); border: 1px solid rgba(255,50,50,0.2); border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #FF8080; margin-bottom: 20px; }
  .field-error { font-size: 12px; color: #FF8080; margin-top: 4px; }
  .auth-links { margin-top: 24px; text-align: center; font-size: 13px; color: rgba(120,170,220,0.5); }
  .auth-links a { color: #00D4FF; text-decoration: none; font-weight: 600; }
  .logo-header { text-align: center; margin-bottom: 28px; }
  .logo-header-title { font-size: 18px; font-weight: 800; background: linear-gradient(135deg,#E8F4FF,#00D4FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
`;
