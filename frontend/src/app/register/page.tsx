'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, IdCard, Lock, Eye, EyeOff, ArrowRight, Loader2, User, Mail, Phone, ShieldCheck, Chrome } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { authAPI, secureStorage } from '@/services/api';

interface RegisterForm {
  ic_number: string;
  full_name: string;
  email: string;
  mobile: string;
  password: string;
  otp: string;
}

export default function RegisterPage() {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const { register, handleSubmit, watch, trigger, formState: { errors } } = useForm<RegisterForm>({
    mode: 'onTouched'
  });

  const mobileNumber = watch('mobile');
  const formValues = watch();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendOTP = async () => {
    // Validate first step fields
    const isValid = await trigger(['ic_number', 'full_name', 'email', 'mobile', 'password']);
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const res = await authAPI.requestOtp(mobileNumber);
      toast.success('OTP sent to your mobile number!');
      setStep('otp');
      setResendCooldown(30);
      
      // Store demo OTP for mock environment testing helper
      if (res.data?.demo_otp) {
        setDemoOtp(res.data.demo_otp);
      } else {
        setDemoOtp(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsSubmitting(true);
    try {
      const res = await authAPI.register(data);
      toast.success('Registration successful!');

      // Save tokens and login the user
      await secureStorage.setItem('access_token', res.data.access_token);
      await secureStorage.setItem('refresh_token', res.data.refresh_token);

      // Redirect to profile setup/dashboard
      window.location.href = '/complete-profile';
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      // Trigger google sign-in mock auth
      const res = await authAPI.googleLogin('valid_token_student@icms.edu');
      await secureStorage.setItem('access_token', res.data.access_token);
      await secureStorage.setItem('refresh_token', res.data.refresh_token);
      toast.success('Signed in with Google!');
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error('Google Sign-in failed');
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
              Join the Innovation Center
            </h1>
            <p className="text-lg text-white/70 mb-8 max-w-md">
              Create a student account to showcase your research, manage team collaborations, and join premium campus tech hackathons.
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

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white dark:bg-dark-900">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Create your account</h2>
          <p className="text-dark-500 dark:text-dark-400 mb-8">Register to begin your innovation journey</p>

          <form onSubmit={handleSubmit(handleRegister)} className="space-y-5">
            <AnimatePresence mode="wait">
              {step === 'details' ? (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                      <input
                        {...register('full_name', {
                          required: 'Full name is required',
                          pattern: { value: /^[a-zA-Z\s\.]+$/, message: 'Name must contain only alphabets, spaces, and dots' }
                        })}
                        placeholder="Arjun Patel"
                        className="input-field pl-10"
                      />
                    </div>
                    {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
                  </div>

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
                      />
                    </div>
                    {errors.ic_number && <p className="text-xs text-red-500 mt-1">{errors.ic_number.message}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                      <input
                        {...register('email', {
                          required: 'Email is required',
                          pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address' }
                        })}
                        type="email"
                        placeholder="arjun@example.com"
                        className="input-field pl-10"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                      <input
                        {...register('mobile', {
                          required: 'Mobile number is required',
                          pattern: { value: /^\d{10}$/, message: 'Must be exactly 10 digits' }
                        })}
                        placeholder="9876543210"
                        className="input-field pl-10"
                      />
                    </div>
                    {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile.message}</p>}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                      <input
                        {...register('password', {
                          required: 'Password is required',
                          minLength: { value: 8, message: 'Must be at least 8 characters' },
                          validate: {
                            upper: (v) => /[A-Z]/.test(v) || 'Must contain at least one uppercase letter',
                            lower: (v) => /[a-z]/.test(v) || 'Must contain at least one lowercase letter',
                            digit: (v) => /\d/.test(v) || 'Must contain at least one digit',
                            special: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) || 'Must contain at least one special character'
                          }
                        })}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="input-field pl-10 pr-10"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={isSubmitting}
                    className="btn-primary w-full py-3 mt-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      <span className="flex items-center justify-center gap-2">Verify Mobile via OTP <ArrowRight className="w-4 h-4" /></span>
                    )}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-dark-800/50 border border-slate-100 dark:border-dark-800 text-center">
                    <ShieldCheck className="w-12 h-12 text-primary-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-dark-800 dark:text-white">Verify SMS OTP</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                      We have sent a 6-digit OTP code to <strong className="text-primary-600 dark:text-primary-400">{mobileNumber}</strong>.
                    </p>
                  </div>

                  {/* OTP Input */}
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">6-Digit Verification Code</label>
                    <input
                      {...register('otp', {
                        required: 'Verification code is required',
                        pattern: { value: /^\d{6}$/, message: 'Must be exactly 6 digits' }
                      })}
                      placeholder="123456"
                      className="input-field text-center text-xl font-bold tracking-widest"
                      maxLength={6}
                    />
                    {errors.otp && <p className="text-xs text-red-500 mt-1 text-center">{errors.otp.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full py-3"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      <span>Complete Registration</span>
                    )}
                  </button>

                  <div className="flex justify-between items-center text-sm mt-4">
                    <button
                      type="button"
                      onClick={() => setStep('details')}
                      className="text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-white transition-colors"
                    >
                      ← Back to details
                    </button>
                    {resendCooldown > 0 ? (
                      <span className="text-dark-400">Resend OTP in {resendCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>

                  {/* Mock OTP Helper for developer/user convenience */}
                  {demoOtp && (
                    <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800 text-center">
                      <p className="text-xs text-green-700 dark:text-green-400">
                        [Mock Provider Code]: <strong className="text-green-800 dark:text-green-300 font-extrabold text-sm">{demoOtp}</strong>
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Social Google Login */}
          <div className="mt-6">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-dark-200 dark:border-dark-800"></div>
              <span className="flex-shrink mx-4 text-dark-400 text-xs uppercase">Or sign up with</span>
              <div className="flex-grow border-t border-dark-200 dark:border-dark-800"></div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dark-200 dark:border-dark-800 hover:bg-slate-50 dark:hover:bg-dark-800/40 text-dark-700 dark:text-dark-300 text-sm font-medium transition-colors"
            >
              <Chrome className="w-5 h-5 text-red-500" />
              Sign up with Google
            </motion.button>
          </div>

          <p className="mt-8 text-center text-sm text-dark-500 dark:text-dark-400">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
