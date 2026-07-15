'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Cpu, IdCard, Lock, Eye, EyeOff, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface LoginForm {
  ic_number: string;
  password: string;
}

export default function LoginPage() {
  const { login, verify2FA, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [icNumberFor2FA, setIcNumberFor2FA] = useState('');
  const [otp, setOtp] = useState('');
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
      
      if (result?.requires_2fa) {
        setIcNumberFor2FA(data.ic_number);
        setShow2FA(true);
        toast.success(result.message || 'OTP sent successfully!', { id: 'login-otp' });
        setIsSubmitting(false);
        return;
      }

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

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verify2FA(icNumberFor2FA, otp);
      toast.success('Login successful!');

      if (result.must_change_password) {
        router.push('/complete-profile?step=password');
      } else if (!result.is_profile_completed) {
        router.push('/complete-profile');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid OTP.');
      setIsSubmitting(false);
    }
  };

  // Pre-compute stable particle configs (runs once on client, never on server)
  const particles = useMemo(() =>
    Array.from({ length: 15 }, () => ({
      x: Math.random() * 700,
      y: Math.random() * 800,
      animY: Math.random() * -100 - 50,
      animX: Math.random() * 100 - 50,
      duration: Math.random() * 5 + 5,
    }))
  , []);

  return (
    <div className="min-h-screen flex bg-dark-900 overflow-hidden font-sans">
      {/* Left Panel - Premium Animated Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-blue via-[#0f172a] to-brand-purple">
        {/* Animated Glow Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-blue/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-brand-purple/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        
        {/* Floating Particles — client-only to avoid SSR hydration mismatch */}
        {mounted && particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-white/20 blur-[1px]"
            initial={{ x: p.x, y: p.y }}
            animate={{
              y: [null, p.animY],
              x: [null, p.animX],
              opacity: [0.2, 0.8, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}

        <div className="relative z-10 flex flex-col justify-center px-16 text-white w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div 
              className="w-24 h-24 mb-10 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(37,99,235,0.4)] border border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center relative group"
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Image 
                src="/logo.jpg" 
                alt="Spark Innovation Cell Logo" 
                width={96} 
                height={96}
                priority
                className="object-contain w-full h-full p-2 drop-shadow-2xl mix-blend-screen"
              />
            </motion.div>
            <h1 className="text-5xl font-heading font-extrabold mb-6 leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              Spark Innovation Center
            </h1>
            <p className="text-xl text-white/70 mb-12 max-w-lg font-medium leading-relaxed">
              Empowering the next generation of innovators.
              Manage projects, track progress, and build the future.
            </p>
            <div className="flex gap-10">
              <motion.div whileHover={{ y: -5 }} className="glass-card p-4 bg-white/5 border-white/10 rounded-xl">
                <div className="text-3xl font-mono font-bold text-brand-cyan">500+</div>
                <div className="text-sm font-medium text-white/60 uppercase tracking-wider mt-1">Students</div>
              </motion.div>
              <motion.div whileHover={{ y: -5 }} className="glass-card p-4 bg-white/5 border-white/10 rounded-xl">
                <div className="text-3xl font-mono font-bold text-brand-emerald">120+</div>
                <div className="text-sm font-medium text-white/60 uppercase tracking-wider mt-1">Projects</div>
              </motion.div>
              <motion.div whileHover={{ y: -5 }} className="glass-card p-4 bg-white/5 border-white/10 rounded-xl">
                <div className="text-3xl font-mono font-bold text-brand-pink">50+</div>
                <div className="text-sm font-medium text-white/60 uppercase tracking-wider mt-1">Events</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Login Form in a Glass Card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative bg-[#0f172a]">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="glass-card p-10 bg-white/5 border-white/10 shadow-2xl relative overflow-hidden">
            {/* Top border highlight */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-blue via-brand-purple to-brand-pink" />
            
            <div className="flex items-center gap-3 mb-8">
              <Sparkles className="w-8 h-8 text-brand-blue" />
              <div>
                <h2 className="text-3xl font-heading font-bold text-white tracking-tight">Welcome back</h2>
                <p className="text-dark-400 mt-1">{show2FA ? 'Enter the OTP sent to your email/mobile' : 'Sign in to your account to continue'}</p>
              </div>
            </div>

            {!show2FA ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-10">
              {/* IC Number */}
              <div className="form-group">
                <div className="relative">
                  <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400 z-20" />
                  <input
                    {...register('ic_number', {
                      required: 'IC Number is required',
                      pattern: { value: /^IC\d{7}$/, message: 'Format: IC followed by 7 digits' }
                    })}
                    placeholder=" "
                    className="peer input-field pl-12 bg-dark-900/50 border-white/10 focus:border-brand-blue/50 focus:bg-dark-900/80 h-12 text-lg rounded-xl"
                    id="login-ic"
                    autoComplete="username"
                  />
                  <label htmlFor="login-ic" className="floating-label left-10">IC Number</label>
                </div>
                {errors.ic_number && <p className="text-xs text-red-400 mt-1.5 font-medium ml-1 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-400"/>{errors.ic_number.message}</p>}
              </div>

              {/* Password */}
              <div className="form-group">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400 z-20" />
                  <input
                    {...register('password', { required: 'Password is required' })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder=" "
                    className="peer input-field pl-12 pr-12 bg-dark-900/50 border-white/10 focus:border-brand-blue/50 focus:bg-dark-900/80 h-12 text-lg rounded-xl"
                    id="login-password"
                    autoComplete="current-password"
                  />
                  <label htmlFor="login-password" className="floating-label left-10">Password</label>
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors z-20">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-1.5 font-medium ml-1 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-400"/>{errors.password.message}</p>}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2.5 text-sm text-dark-300 hover:text-white cursor-pointer transition-colors group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" className="peer sr-only" />
                    <div className="w-5 h-5 border-2 border-dark-400 rounded group-hover:border-brand-blue peer-checked:bg-brand-blue peer-checked:border-brand-blue transition-all" />
                    <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 14 14" fill="none">
                      <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
                    </svg>
                  </div>
                  Remember me
                </label>
                <Link href="/forgot-password" className="text-sm text-brand-blue hover:text-brand-cyan font-semibold transition-colors">
                  Forgot password?
                </Link>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full h-12 rounded-xl text-base font-bold tracking-wide mt-4 relative group overflow-hidden"
                id="login-submit"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  <span className="flex items-center justify-center gap-2 relative z-10">Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
                )}
                </motion.button>
              </form>
            ) : (
              <form onSubmit={handleVerify2FA} className="space-y-6 relative z-10">
                <div className="form-group">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400 z-20" />
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      type="text"
                      maxLength={6}
                      placeholder=" "
                      className="peer input-field pl-12 bg-dark-900/50 border-white/10 focus:border-brand-blue/50 focus:bg-dark-900/80 h-12 text-lg rounded-xl font-mono tracking-[0.5em]"
                      required
                      autoFocus
                    />
                    <label className="floating-label left-10">6-Digit OTP</label>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full h-12 rounded-xl text-base font-bold tracking-wide mt-4 relative group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    <span className="flex items-center justify-center gap-2 relative z-10">Verify & Login <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
                  )}
                </motion.button>
                
                <div className="text-center mt-4">
                  <button type="button" onClick={() => setShow2FA(false)} className="text-sm text-dark-400 hover:text-white transition-colors">
                    Back to login
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="mt-8 text-center text-sm text-dark-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-blue hover:text-brand-cyan font-bold transition-colors">
              Register here
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
