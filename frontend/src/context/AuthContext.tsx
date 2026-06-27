'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/services/api';
import { tokenStorage } from '@/services/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStudent: boolean;
  login: (ic_number: string, password: string) => Promise<{
    is_profile_completed: boolean;
    must_change_password: boolean;
  }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  completeProfile: (data: { full_name: string; email: string; mobile: string }) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    // Synchronously check token first — avoids a wasted network call
    const token = tokenStorage.getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await authAPI.me();
      // Handle both raw user object and { success: true, user: {...} } formats
      const userData = res.data.success && res.data.user ? res.data.user : res.data;
      setUser(userData);
    } catch (error) {
      console.error("Error in refreshUser:", error);
      // Token invalid/expired — clear everything
      setUser(null);
      tokenStorage.clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Bootstrap: check auth state once on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (ic_number: string, password: string) => {
    const res = await authAPI.login({ ic_number, password });
    const { access_token, refresh_token, is_profile_completed, must_change_password } = res.data;

    // 1. Persist tokens BEFORE calling /me so the interceptor can read them synchronously
    tokenStorage.setTokens(access_token, refresh_token);

    // 2. Fetch full user profile now that the token is in localStorage
    await refreshUser();

    // 3. If refreshUser fails, it clears tokens. We should throw so the UI shows an error.
    if (!tokenStorage.getToken()) {
      throw { response: { data: { detail: "Failed to load user profile. Check backend logs." } } };
    }

    return { is_profile_completed, must_change_password };
  };

  const logout = () => {
    // Best-effort logout call (fire & forget)
    authAPI.logout().catch(() => {});
    tokenStorage.clearTokens();
    setUser(null);
    router.push('/login');
  };

  const completeProfile = async (data: { full_name: string; email: string; mobile: string }) => {
    await authAPI.completeProfile(data);
    await refreshUser();
  };

  const changePassword = async (newPassword: string) => {
    await authAPI.changePassword({ new_password: newPassword });
    await refreshUser();
  };

  const isAdmin = user?.role?.name === 'admin';
  const isStudent = user?.role?.name === 'student';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        isStudent,
        login,
        logout,
        refreshUser,
        completeProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
