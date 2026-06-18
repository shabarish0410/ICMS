'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '@/services/api';
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

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const res = await authAPI.me();
      setUser(res.data);
    } catch {
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (ic_number: string, password: string) => {
    const res = await authAPI.login({ ic_number, password });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    await refreshUser();
    return {
      is_profile_completed: res.data.is_profile_completed,
      must_change_password: res.data.must_change_password,
    };
  };

  const completeProfile = async (data: { full_name: string; email: string; mobile: string }) => {
    await authAPI.completeProfile(data);
    await refreshUser();
  };

  const changePassword = async (newPassword: string) => {
    await authAPI.changePassword({ new_password: newPassword });
    await refreshUser();
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    window.location.href = '/login';
  };

  const isAdmin = user?.role?.name === 'admin';
  const isStudent = user?.role?.name === 'student';

  return (
    <AuthContext.Provider
      value={{
        user, isLoading, isAuthenticated: !!user,
        isAdmin, isStudent,
        login, logout, refreshUser, completeProfile, changePassword,
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
