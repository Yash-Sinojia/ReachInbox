'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'auth_failed') {
      toast.error('Authentication failed. Please try again.');
    }
    authApi.getMe()
      .then(() => router.replace('/dashboard'))
      .catch(() => setLoading(false));
  }, [router, searchParams]);

  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleLoginUrl();
  };

  if (loading) {
    return (
      <div className="login-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, border: '2px solid #E5E7EB', borderTopColor: '#00A859', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: '#6B7280' }}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <h1 className="login-title">Login</h1>

        {/* Google OAuth */}
        <button
          id="google-login-btn"
          onClick={handleGoogleLogin}
          className="login-google-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Login with Google
        </button>

        {/* Divider */}
        <div className="login-divider">
          <div className="login-divider-line" />
          <span className="login-divider-text">or sign up through email</span>
          <div className="login-divider-line" />
        </div>

        {/* Form */}
        <input
          type="email"
          placeholder="Email ID"
          className="login-input"
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          className="login-input"
          autoComplete="current-password"
        />

        <button
          onClick={handleGoogleLogin}
          className="login-submit-btn"
        >
          Login
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-page">
        <div style={{ width: 20, height: 20, border: '2px solid #E5E7EB', borderTopColor: '#00A859', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
