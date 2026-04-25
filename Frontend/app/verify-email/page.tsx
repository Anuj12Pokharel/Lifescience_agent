'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useVerifyEmail, useResendVerification } from '@/lib/hooks/use-auth';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';

  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [resendEmail, setResendEmail] = useState('');

  useEffect(() => {
    if (uid && token) verify.mutate({ uid, token });
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errorMsg: string =
    (verify.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ?? 'Verification failed. The link may have expired.';

  return (
    <div className="auth-page">
      <style>{AUTH_STYLES}</style>
      <div className="auth-card" style={{ textAlign: 'center' }}>

        {verify.isPending && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 8 }}>Verifying your email…</h2>
            <p style={{ color: 'rgba(120,170,220,0.7)' }}>Please wait a moment.</p>
          </>
        )}

        {verify.isSuccess && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 8 }}>Email Verified!</h2>
            <p style={{ color: 'rgba(120,170,220,0.7)', marginBottom: 24 }}>Redirecting you to login…</p>
            <Link href="/login" style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'none' }}>Go to Login →</Link>
          </>
        )}

        {verify.isError && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#E8F4FF', marginBottom: 8 }}>Verification Failed</h2>
            <p style={{ color: '#FF8080', marginBottom: 24 }}>{errorMsg}</p>

            {resend.isSuccess ? (
              <p style={{ color: '#00FF88', fontSize: 14 }}>
                If an account exists, a new verification email has been sent.
              </p>
            ) : (
              <form
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  resend.mutate({ email: resendEmail });
                }}
                style={{ textAlign: 'left' }}
              >
                <p style={{ fontSize: 13, color: 'rgba(160,200,240,0.7)', marginBottom: 12 }}>
                  Resend verification email:
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="your@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    style={{ flex: 1, padding: '10px 14px' }}
                  />
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={resend.isPending}
                    style={{ width: 'auto', padding: '10px 18px', marginTop: 0 }}
                  >
                    {resend.isPending ? '…' : 'Resend'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ background: '#020B18', minHeight: '100vh' }} />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

const AUTH_STYLES = `
  .auth-page { min-height: 100vh; background: #020B18; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Inter', sans-serif; }
  .auth-card { width: 100%; max-width: 440px; background: rgba(0,15,40,0.9); border: 1px solid rgba(0,100,200,0.25); border-radius: 20px; padding: 40px; backdrop-filter: blur(20px); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .form-input { width: 100%; background: rgba(0,20,50,0.8); border: 1px solid rgba(0,100,180,0.3); border-radius: 10px; padding: 12px 14px; font-size: 14px; color: #E8F4FF; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
  .form-input:focus { border-color: rgba(0,212,255,0.5); }
  .form-input::placeholder { color: rgba(100,150,200,0.4); }
  .submit-btn { padding: 13px; background: linear-gradient(135deg,rgba(0,150,255,0.3),rgba(0,100,200,0.2)); border: 1px solid rgba(0,212,255,0.3); border-radius: 10px; color: #00D4FF; font-size: 14px; font-weight: 700; cursor: pointer; }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
`;
