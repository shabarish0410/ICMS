'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { usersAPI, authAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { Sun, Moon, Monitor, User, Shield, Bell, Palette, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, refreshUser, changePassword } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setPhone(user.mobile || '');
    }
  }, [user]);

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    setSavingProfile(true);
    try {
      await usersAPI.update(user.id, {
        full_name: fullName,
        email: email || null,
        mobile: phone || null,
      });
      await refreshUser();
      toast.success('Your changes have been saved');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!user?.ic_number) {
      toast.error('User information missing');
      return;
    }
    setRequestingReset(true);
    try {
      const res = await authAPI.forgotPassword({ ic_number: user.ic_number, method: 'email' });
      toast.success(res.data.message || 'OTP sent to your email');
      if (res.data.demo_otp) {
        toast('Demo mode: OTP is ' + res.data.demo_otp, { icon: 'ℹ️' });
      }
      setShowOtpModal(true);
    } catch (err: any) {
      console.error('Password Reset Request Error:', err);
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
      const fallback = err.message || 'Failed to request password reset';
      toast.error(typeof msg === 'string' ? msg : fallback);
    } finally {
      setRequestingReset(false);
    }
  };

  const handleVerifyAndChangePassword = async () => {
    if (!user?.ic_number) {
      toast.error('User information missing');
      return;
    }
    if (!otp) {
      toast.error('Please enter the OTP sent to your email');
      return;
    }
    if (!newPassword) {
      toast.error('Password cannot be empty');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setVerifyingOtp(true);
    try {
      await authAPI.verifyOtp({ 
        ic_number: user.ic_number, 
        otp, 
        new_password: newPassword 
      });
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      setShowOtpModal(false);
    } catch (err: any) {
      console.error('Verify OTP Error:', err);
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
      const fallback = err.message || 'Failed to update password';
      toast.error(typeof msg === 'string' ? msg : fallback);
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Settings</h1>
        <p className="text-dark-500 dark:text-dark-400 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <User className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Profile</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Phone</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Role</label>
            <input type="text" defaultValue={user?.role?.name?.replace('_', ' ')} className="input-field capitalize" disabled />
          </div>
        </div>
        <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary mt-2 flex items-center justify-center gap-2 min-w-[125px]">
          {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </button>
      </div>

      {/* Theme Section */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Palette className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Appearance</h2>
        </div>
        {mounted && (
          <div className="flex gap-3">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  theme === value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                    : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Notifications</h2>
        </div>
        {[
          { label: 'Event Reminders', desc: 'Get notified about upcoming events' },
          { label: 'Project Updates', desc: 'Receive project milestone notifications' },
          { label: 'Certificate Alerts', desc: 'Know when certificates are issued' },
          { label: 'Admin Announcements', desc: 'Important system announcements' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-dark-900 dark:text-white">{item.label}</p>
              <p className="text-xs text-dark-400">{item.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-dark-200 dark:bg-dark-700 peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-dark-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
            </label>
          </div>
        ))}
      </div>

      {/* Security */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Security</h2>
        </div>
        <p className="text-sm text-dark-500">
          To ensure your account's security, changing your password requires email verification.
          Click the button below to receive a secure OTP to your registered email address.
        </p>
        <button 
          onClick={handleRequestPasswordReset} 
          disabled={requestingReset} 
          className="btn-primary mt-2 flex items-center justify-center gap-2 min-w-[200px]"
        >
          {requestingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request Password Reset'}
        </button>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-200 dark:border-dark-700 shadow-2xl space-y-4"
          >
            <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Verify and Reset Password</h3>
            <p className="text-sm text-dark-500 mb-4">Enter the OTP sent to your email and your new password.</p>
            
            <div>
              <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Enter OTP</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" className="input-field text-center tracking-widest font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="input-field" />
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowOtpModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button 
                onClick={handleVerifyAndChangePassword} 
                disabled={verifyingOtp} 
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
