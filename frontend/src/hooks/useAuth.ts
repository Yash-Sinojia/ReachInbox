'use client';

import { useState, useEffect, useCallback } from 'react';
import { authApi } from '@/lib/api';
import { User } from '@/types';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      setUser(data);
    } catch {
      setUser(null);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    router.replace('/login');
  };

  return { user, loading, logout };
}
