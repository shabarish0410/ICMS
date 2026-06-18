'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Cpu, IdCard, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface LoginForm {
  ic_number: string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      const result = await login(data.ic_number, data.password);
      toast.success('Welcome back!');

      if (result.must_change_password) {
        window.location.href = '/complete-profile?step=password';
      } else if (!result.is_profile_completed) {
        window.location.href = '/complete-profile';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-8">
              <Cpu className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Innovation Center<br />Management System
            </h1>
            <p className="text-lg text-white/70 mb-8 max-w-md">
              Empowering the next generation of innovators.
              Manage projects, track progress, and build the future.
            </p>
            <div className="flex gap-8">
              <div>
                <div className="text-3xl font-bold">500+</div>
                <div className="text-sm text-white/50">Students</div>
              </div>
              <div>
                <div className="text-3xl font-bold">120+</div>
                <div className="text-sm text-white/50">Projects</div>
              </div>
              <div>
                <div className="text-3xl font-bold">50+</div>
                <div className="text-sm text-white/50">Events</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white dark:bg-dark-900">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Welcome back</h2>
          <p className="text-dark-500 dark:text-dark-400 mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* IC Number */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">IC Number</label>
              <div className="relative">
                <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input
                  {...register('ic_number', {
                    required: 'IC Number is required',
                    pattern: { value: /^IC\d{7}$/, message: 'Format: IC followed by 7 digits (e.g., IC2024001)' }
                  })}
                  placeholder="IC2024001"
                  className="input-field pl-10"
                  id="login-ic"
                />
              </div>
              {errors.ic_number && <p className="text-xs text-red-500 mt-1">{errors.ic_number.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                  id="login-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-400">
                <input type="checkbox" className="rounded border-dark-300" />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3" id="login-submit">
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <span className="flex items-center justify-center gap-2">Sign in <ArrowRight className="w-4 h-4" /></span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-dark-500 dark:text-dark-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium transition-colors">
              Register here
            </Link>
          </p>

          {/* Demo Credentials */}
          <div className="mt-8 p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
            <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">Demo Credentials</p>
            <div className="space-y-1 text-xs text-primary-600 dark:text-primary-400">
              <p><strong>Admin:</strong> IC0000001 | Admin@123</p>
              <p><strong>Student:</strong> IC2024001 | icms@IC2024001</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
