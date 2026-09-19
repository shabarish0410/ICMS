'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, Loader2, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface PasswordForm {
  new_password: string;
  confirm_password: string;
  otp: string;
}

export default function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { changePassword, requestChangePasswordOtp } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const passwordForm = useForm<PasswordForm>();

  const handleRequestOTP = async (e: React.MouseEvent) => {
    e.preventDefault();
    const new_pwd = passwordForm.getValues('new_password');
    const confirm_pwd = passwordForm.getValues('confirm_password');
    if (!new_pwd || new_pwd !== confirm_pwd) {
      toast.error('Please enter valid matching passwords first');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await requestChangePasswordOtp();
      toast.success('OTP sent to your mobile number!');
      setOtpSent(true);
      if (res.data?.demo_otp) {
        setDemoOtp(res.data.demo_otp);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (data: PasswordForm) => {
    if (data.new_password !== data.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword(data.new_password, data.otp);
      toast.success('Password changed successfully!');
      onClose();
      passwordForm.reset();
      setOtpSent(false);
      setDemoOtp(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-lg shadow-2xl border border-dark-200 dark:border-dark-700 flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-dark-100 dark:border-dark-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Change Password</h3>
              <button 
                onClick={onClose}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      {...passwordForm.register('new_password', {
                        required: 'Password is required',
                        minLength: { value: 8, message: 'Min 8 characters' },
                        pattern: {
                          value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/,
                          message: 'Must include uppercase, lowercase, number, special char',
                        },
                      })}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="input-field pl-10 pr-10"
                      disabled={otpSent}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400" disabled={otpSent}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.new_password && (
                    <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.new_password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      {...passwordForm.register('confirm_password', { required: 'Please confirm password' })}
                      type="password"
                      placeholder="••••••••"
                      className="input-field pl-10"
                      disabled={otpSent}
                    />
                  </div>
                  {passwordForm.formState.errors.confirm_password && (
                    <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirm_password.message}</p>
                  )}
                </div>

                {otpSent && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5 mt-4">Enter OTP</label>
                    <input
                      {...passwordForm.register('otp', { required: 'OTP is required' })}
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      className="input-field"
                    />
                    {demoOtp && (
                      <p className="text-xs text-blue-500 mt-1">Demo OTP: {demoOtp}</p>
                    )}
                    {passwordForm.formState.errors.otp && (
                      <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.otp.message}</p>
                    )}
                  </motion.div>
                )}

                {!otpSent ? (
                  <button type="button" onClick={handleRequestOTP} disabled={isSubmitting} className="btn-primary w-full py-3 mt-2">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                      <span className="flex items-center justify-center gap-2">Send OTP <ArrowRight className="w-4 h-4" /></span>
                    )}
                  </button>
                ) : (
                  <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 mt-2">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                      <span className="flex items-center justify-center gap-2">Verify & Change Password <ArrowRight className="w-4 h-4" /></span>
                    )}
                  </button>
                )}
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
