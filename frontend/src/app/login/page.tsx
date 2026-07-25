'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { IdCard, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface LoginForm {
  ic_number: string;
  password: string;
}

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      const result = await login(data.ic_number, data.password);

      toast.success('Welcome back!');

      if (result.must_change_password) {
        router.push('/complete-profile?step=password');
      } else if (!result.is_profile_completed) {
        router.push('/complete-profile');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed. Please check your credentials.');
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex bg-[#0F172A] overflow-hidden font-sans">
      {/* Left Panel - Clean Gradient Background */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-center px-16 text-white"
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 45%, #2563EB 100%)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-xl"
        >
          <div className="flex items-center gap-4 mb-8">
            <Image 
              src="/logo.jpg" 
              alt="Spark Innovation Cell Logo" 
              width={72} 
              height={72}
              priority
              className="rounded-xl object-contain shadow-sm bg-white"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tight text-white">
            Spark Innovation Center
          </h1>
          <p className="text-lg md:text-xl text-[#94A3B8] mb-12 font-medium leading-relaxed max-w-md">
            Empowering innovation through projects, research, collaboration, and technology.
          </p>
          
          <div className="flex gap-6">
            <div className="p-5 bg-[#1E293B] border border-[#334155] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] w-32 flex flex-col justify-center">
              <div className="text-2xl font-bold text-white mb-1">500+</div>
              <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Students</div>
            </div>
            <div className="p-5 bg-[#1E293B] border border-[#334155] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] w-32 flex flex-col justify-center">
              <div className="text-2xl font-bold text-white mb-1">120+</div>
              <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Projects</div>
            </div>
            <div className="p-5 bg-[#1E293B] border border-[#334155] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] w-32 flex flex-col justify-center">
              <div className="text-2xl font-bold text-white mb-1">50+</div>
              <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Events</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Clean Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#0F172A]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-[420px]"
        >
          <div 
            className="p-8 sm:p-10 relative overflow-hidden"
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '20px',
              boxShadow: '0 10px 30px rgba(0,0,0,.25)'
            }}
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Welcome back</h2>
              <p className="text-[#94A3B8] text-sm">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* IC Number */}
              <div>
                <label className="block text-sm font-medium text-[#94A3B8] mb-1.5" htmlFor="login-ic">
                  IC Number
                </label>
                <div className="relative">
                  <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] pointer-events-none" />
                  <input
                    {...register('ic_number', {
                      required: 'IC Number is required',
                      pattern: { value: /^IC\d{7}$/, message: 'Format: IC followed by 7 digits' }
                    })}
                    placeholder="e.g. IC2024004"
                    className="w-full pl-11 pr-4 py-3 bg-[#334155] border border-transparent text-white rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all duration-200"
                    id="login-ic"
                    autoComplete="username"
                  />
                </div>
                {errors.ic_number && <p className="text-xs text-red-400 mt-1.5">{errors.ic_number.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-[#94A3B8] mb-1.5" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] pointer-events-none" />
                  <input
                    {...register('password', { required: 'Password is required' })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="w-full pl-11 pr-11 py-3 bg-[#334155] border border-transparent text-white rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all duration-200"
                    id="login-password"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors duration-200">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-1.5">{errors.password.message}</p>}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1 pb-1">
                <label className="flex items-center gap-2.5 text-sm text-[#94A3B8] hover:text-white cursor-pointer transition-colors duration-200 group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" className="peer sr-only" />
                    <div className="w-4 h-4 border-2 border-[#94A3B8] rounded bg-transparent group-hover:border-[#2563EB] peer-checked:bg-[#2563EB] peer-checked:border-[#2563EB] transition-all duration-200" />
                    <svg className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200" viewBox="0 0 14 14" fill="none">
                      <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
                    </svg>
                  </div>
                  Remember me
                </label>
                <Link href="/forgot-password" className="text-sm text-[#2563EB] hover:text-[#1D4ED8] font-medium transition-colors duration-200">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-semibold text-sm transition-colors duration-200 flex items-center justify-center disabled:opacity-70 disabled:pointer-events-none"
                id="login-submit"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">Sign In <ArrowRight className="w-4 h-4" /></span>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-[#94A3B8]">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[#2563EB] hover:text-[#1D4ED8] font-medium transition-colors duration-200">
              Register here
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
