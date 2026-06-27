'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { authAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { Cpu, IdCard, Mail, Phone, Lock, ArrowRight, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ForgotPasswordPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const [step, setStep] = useState<'ic' | 'otp' | 'done'>('ic');
  const [method, setMethod] = useState<'email' | 'mobile'>('email');
  const [icNumber, setIcNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');

  const handleRequestOtp = async () => {
    if (!icNumber.match(/^IC\d{7}$/)) { toast.error('Invalid IC Number format'); return; }
    setIsSubmitting(true);
    try {
      const res = await authAPI.forgotPassword({ ic_number: icNumber, method });
      toast.success('OTP sent!');
      if (res.data.demo_otp) setDemoOtp(res.data.demo_otp);
      setStep('otp');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setIsSubmitting(true);
    try {
      await authAPI.verifyOtp({ ic_number: icNumber, otp, new_password: newPassword });
      toast.success('Password reset successfully!');
      setStep('done');
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-br from-dark-50 to-primary-50 dark:from-dark-900 dark:to-dark-950">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-dark-900 dark:text-white">Spark</span>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-xl border border-dark-200 dark:border-dark-700">
          {step === 'ic' && (
            <div>
              <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Forgot Password</h2>
              <p className="text-dark-500 dark:text-dark-400 mb-6 text-sm">Enter your IC Number and choose how to receive your OTP.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">IC Number</label>
                  <div className="relative">
                    <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input value={icNumber} onChange={(e) => setIcNumber(e.target.value.toUpperCase())}
                      placeholder="IC2024001" className="input-field pl-10" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">Verify via</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setMethod('email')} type="button"
                      className={`p-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${method === 'email' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'border-dark-200 dark:border-dark-700 text-dark-500'}`}>
                      <Mail className="w-4 h-4" /> Email
                    </button>
                    <button onClick={() => setMethod('mobile')} type="button"
                      className={`p-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${method === 'mobile' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'border-dark-200 dark:border-dark-700 text-dark-500'}`}>
                      <Phone className="w-4 h-4" /> Mobile
                    </button>
                  </div>
                </div>

                <button onClick={handleRequestOtp} disabled={isSubmitting} className="btn-primary w-full py-3 mt-2">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                    <span className="flex items-center justify-center gap-2">Send OTP <ArrowRight className="w-4 h-4" /></span>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'otp' && (
            <div>
              <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Verify OTP</h2>
              <p className="text-dark-500 dark:text-dark-400 mb-6 text-sm">Enter the OTP sent to your {method}.</p>

              {demoOtp && (
                <div className="p-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                  <strong>Demo OTP:</strong> {demoOtp}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">OTP Code</label>
                  <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456"
                    className="input-field text-center text-lg tracking-widest font-mono" maxLength={6} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars, upper, lower, number, special" className="input-field pl-10" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password" className="input-field pl-10" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('ic')} className="btn-secondary flex-1 flex items-center justify-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={handleVerifyOtp} disabled={isSubmitting} className="btn-primary flex-1">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Reset Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Password Reset!</h2>
              <p className="text-dark-500">Redirecting to login...</p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-dark-500 mt-6">
          <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Back to Login</Link>
        </p>
      </motion.div>
    </div>
  );
}
