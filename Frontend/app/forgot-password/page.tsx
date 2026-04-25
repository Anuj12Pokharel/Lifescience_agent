'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useForgotPassword } from '@/lib/hooks/use-auth';

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');

  return (
    <div className="auth-page">
      <style>{AUTH_STYLES}</style>
      <div className="auth-card">
        <div className="logo-header">
          <div className="logo-header-title">Life Science AI</div>
        </div>

        {forgotPassword.isSuccess ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 8 }}>Check your inbox</h2>
            <p style={{ color: 'rgba(120,170,220,0.7)', marginBottom: 24 }}>
              If an account with that email exists, we sent a password reset link.
            </p>
            <Link href="/login" style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'none' }}>
              ← Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Reset password</h1>
            <p className="auth-subtitle">We&apos;ll send a reset link to your email</p>

            <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); forgotPassword.mutate({ email }); }}>
              <div style={{ marginBottom: 20 }}>
                <label className="form-label">Email address</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Mail size={16} /></span>
                  <input className="form-input" type="email" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Link href="/login" style={{ fontSize: 13, color: '#00D4FF', textDecoration: 'none', fontWeight: 600 }}>
                ← Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const AUTH_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  .auth-page { min-height: 100vh; background: #020B18; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Inter', sans-serif; }
  .auth-card { width: 100%; max-width: 420px; background: rgba(0,15,40,0.9); border: 1px solid rgba(0,100,200,0.25); border-radius: 20px; padding: 40px; backdrop-filter: blur(20px); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .auth-title { font-size: 26px; font-weight: 800; color: #E8F4FF; margin-bottom: 4px; letter-spacing: -0.03em; }
  .auth-subtitle { font-size: 14px; color: rgba(120,170,220,0.6); margin-bottom: 32px; }
  .form-label { display: block; font-size: 13px; font-weight: 600; color: rgba(160,200,240,0.8); margin-bottom: 8px; }
  .input-wrapper { position: relative; }
  .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(0,150,220,0.5); pointer-events: none; }
  .form-input { width: 100%; background: rgba(0,20,50,0.8); border: 1px solid rgba(0,100,180,0.3); border-radius: 10px; padding: 12px 14px 12px 40px; font-size: 14px; color: #E8F4FF; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
  .form-input:focus { border-color: rgba(0,212,255,0.5); box-shadow: 0 0 0 3px rgba(0,212,255,0.1); }
  .form-input::placeholder { color: rgba(100,150,200,0.4); }
  .submit-btn { width: 100%; padding: 13px; background: linear-gradient(135deg,rgba(0,150,255,0.3),rgba(0,100,200,0.2)); border: 1px solid rgba(0,212,255,0.3); border-radius: 10px; color: #00D4FF; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .logo-header { text-align: center; margin-bottom: 28px; }
  .logo-header-title { font-size: 18px; font-weight: 800; background: linear-gradient(135deg,#E8F4FF,#00D4FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
`;
