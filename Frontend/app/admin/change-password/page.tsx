'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';
import { useChangePassword } from '@/lib/hooks/use-auth';
import DashboardLayout from '@/components/dashboard-layout';

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

export default function AdminChangePasswordPage() {
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!allValid || !passwordsMatch) return;
    changePassword.mutate(form, {
      onSuccess: () => setForm({ old_password: '', new_password: '', new_password_confirm: '' }),
    });
  };

  return (
    <DashboardLayout requireAdmin>
      <style>{FORM_STYLES}</style>
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 4 }}>Change Password</h1>
        <p style={{ fontSize: 14, color: 'rgba(120,170,220,0.6)', marginBottom: 28 }}>Update your admin account password</p>

        <div className="form-card">
          {globalError && <div className="error-box">{globalError}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div className="input-wrapper">
                <span className="input-icon"><Lock size={16} /></span>
                <input className="form-input" type={showOld ? 'text' : 'password'} placeholder="Current password"
                  value={form.old_password} onChange={(e) => setForm({ ...form, old_password: e.target.value })} required />
                <button type="button" className="input-suffix-btn" onClick={() => setShowOld(!showOld)}>
                  {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.old_password?.map((err, i) => <p key={i} className="field-error">{err}</p>)}
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="input-wrapper">
                <span className="input-icon"><Lock size={16} /></span>
                <input className="form-input" type={showNew ? 'text' : 'password'} placeholder="New password"
                  value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required />
                <button type="button" className="input-suffix-btn" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.new_password?.map((err, i) => <p key={i} className="field-error">{err}</p>)}
              {form.new_password && (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
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
                <input className="form-input" type={showNew ? 'text' : 'password'} placeholder="Repeat new password"
                  value={form.new_password_confirm} onChange={(e) => setForm({ ...form, new_password_confirm: e.target.value })} required />
              </div>
              {form.new_password_confirm && !passwordsMatch && <p className="field-error">Passwords do not match</p>}
              {fieldErrors.new_password_confirm?.map((err, i) => <p key={i} className="field-error">{err}</p>)}
            </div>

            <button type="submit" className="submit-btn"
              disabled={changePassword.isPending || !allValid || !passwordsMatch || !form.old_password}>
              {changePassword.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

const FORM_STYLES = `
  .form-card { background: rgba(0,15,40,0.8); border: 1px solid rgba(0,100,200,0.2); border-radius: 16px; padding: 28px; }
  .form-group { margin-bottom: 18px; }
  .form-label { display: block; font-size: 13px; font-weight: 600; color: rgba(160,200,240,0.8); margin-bottom: 8px; }
  .input-wrapper { position: relative; }
  .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(0,150,220,0.5); pointer-events: none; }
  .form-input { width: 100%; background: rgba(0,20,50,0.8); border: 1px solid rgba(0,100,180,0.3); border-radius: 10px; padding: 12px 40px; font-size: 14px; color: #E8F4FF; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
  .form-input:focus { border-color: rgba(0,212,255,0.5); box-shadow: 0 0 0 3px rgba(0,212,255,0.1); }
  .form-input::placeholder { color: rgba(100,150,200,0.4); }
  .input-suffix-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: rgba(0,150,220,0.5); padding: 0; display: flex; }
  .submit-btn { padding: 12px 28px; background: linear-gradient(135deg,rgba(0,150,255,0.3),rgba(0,100,200,0.2)); border: 1px solid rgba(0,212,255,0.3); border-radius: 10px; color: #00D4FF; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .error-box { background: rgba(255,50,50,0.08); border: 1px solid rgba(255,50,50,0.2); border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #FF8080; margin-bottom: 18px; }
  .field-error { font-size: 12px; color: #FF8080; margin-top: 4px; }
`;
