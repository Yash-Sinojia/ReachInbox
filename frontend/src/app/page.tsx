'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

// Root page - redirect to dashboard if logged in, else to login
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    authApi.getMe()
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}
