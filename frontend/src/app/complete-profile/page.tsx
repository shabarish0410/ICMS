'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle, Cpu } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface ProfileForm {
  full_name: string;
  email: string;
  mobile: string;
}

interface PasswordForm {
  new_password: string;
  confirm_password: string;
}

export default function CompleteProfilePage() {
  const { user, completeProfile, changePassword } = useAuth();
  const searchParams = useSearchParams();
  const startStep = searchParams.get('step') === 'password' ? 'password' : 'profile';

  const [step, setStep] = useState<'password' | 'profile' | 'done'>(
    user?.must_change_password ? 'password' : startStep === 'password' ? 'password' : 'profile'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profileForm = useForm<ProfileForm>({
    defaultValues: {
      full_name: user?.full_name || '',
      email: user?.email || '',
      mobile: user?.mobile || '',
    },
  });

  const { reset } = profileForm;

  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name || '',
        email: user.email || '',
        mobile: user.mobile || '',
      });
      if (user.must_change_password) {
        setStep('password');
      }
    }
  }, [user, reset]);

  const passwordForm = useForm<PasswordForm>();

  const handlePasswordSubmit = async (data: PasswordForm) => {
    if (data.new_password !== data.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword(data.new_password);
      toast.success('Password changed successfully!');
      if (!user?.is_profile_completed) {
        setStep('profile');
      } else {
        setStep('done');
        setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (data: ProfileForm) => {
    setIsSubmitting(true);
    try {
      await completeProfile(data);
      toast.success('Profile completed!');
      setStep('done');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-br from-dark-50 to-primary-50 dark:from-dark-900 dark:to-dark-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-dark-900 dark:text-white">ICMS</span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`flex items-center gap-2 text-sm font-medium ${step === 'password' ? 'text-primary-600' : 'text-green-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${step === 'password' ? 'bg-primary-600' : 'bg-green-500'}`}>
              {step !== 'password' ? <CheckCircle className="w-4 h-4" /> : '1'}
            </div>
            Set Password
          </div>
          <div className="flex-1 h-0.5 bg-dark-200 dark:bg-dark-700" />
          <div className={`flex items-center gap-2 text-sm font-medium ${step === 'profile' ? 'text-primary-600' : step === 'done' ? 'text-green-600' : 'text-dark-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${step === 'profile' ? 'bg-primary-600' : step === 'done' ? 'bg-green-500' : 'bg-dark-300'}`}>
              {step === 'done' ? <CheckCircle className="w-4 h-4" /> : '2'}
            </div>
            Complete Profile
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 shadow-xl border border-dark-200 dark:border-dark-700">
          {step === 'password' && (
            <div>
              <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Change Your Password</h2>
              <p className="text-dark-500 dark:text-dark-400 mb-6 text-sm">
                For security, please set a new password. Must include uppercase, lowercase, number, and special character.
              </p>

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
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400">
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
                    />
                  </div>
                  {passwordForm.formState.errors.confirm_password && (
                    <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirm_password.message}</p>
                  )}
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 mt-2">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                    <span className="flex items-center justify-center gap-2">Set Password <ArrowRight className="w-4 h-4" /></span>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'profile' && (
            <div>
              <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Complete Your Profile</h2>
              <p className="text-dark-500 dark:text-dark-400 mb-6 text-sm">
                Please provide your contact details to complete your profile setup.
              </p>

              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      {...profileForm.register('full_name', { required: 'Name is required' })}
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      {...profileForm.register('email', {
                        required: 'Email is required',
                        pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
                      })}
                      type="email"
                      placeholder="you@university.edu"
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      {...profileForm.register('mobile', {
                        required: 'Mobile is required',
                        pattern: { value: /^\d{10}$/, message: 'Must be 10 digits' },
                      })}
                      placeholder="9876543210"
                      className="input-field pl-10"
                    />
                  </div>
                  {profileForm.formState.errors.mobile && (
                    <p className="text-xs text-red-500 mt-1">{profileForm.formState.errors.mobile.message}</p>
                  )}
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 mt-2">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                    <span className="flex items-center justify-center gap-2">Complete Setup <ArrowRight className="w-4 h-4" /></span>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-2">All Set!</h2>
              <p className="text-dark-500">Redirecting to your dashboard...</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
