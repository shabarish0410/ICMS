'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { usersAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { User, Shield, ScanFace, Lock, Loader2, Smartphone, CheckCircle2, ChevronRight } from 'lucide-react';
import FaceRegistrationPage from '../face-registration/page';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'face'>('profile');

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

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

  const renderTabs = () => (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 border-b border-dark-100 dark:border-white/10 mb-8">
      <button
        onClick={() => setActiveTab('profile')}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
          activeTab === 'profile' 
            ? 'bg-dark-50 dark:bg-white/10 text-dark-900 dark:text-white border border-dark-200 dark:border-white/10 shadow-sm' 
            : 'text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5'
        }`}
      >
        <User className="w-4 h-4" /> Personal Information
      </button>
      <button
        onClick={() => setActiveTab('security')}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
          activeTab === 'security' 
            ? 'bg-dark-50 dark:bg-white/10 text-dark-900 dark:text-white border border-dark-200 dark:border-white/10 shadow-sm' 
            : 'text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5'
        }`}
      >
        <Shield className="w-4 h-4" /> Account Security
      </button>
      <button
        onClick={() => setActiveTab('face')}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
          activeTab === 'face' 
            ? 'bg-dark-50 dark:bg-white/10 text-dark-900 dark:text-white border border-dark-200 dark:border-white/10 shadow-sm' 
            : 'text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5'
        }`}
      >
        <ScanFace className="w-4 h-4" /> Face Registration
      </button>
    </div>
  );

  if (!mounted) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-heading font-extrabold text-dark-900 dark:text-white tracking-tight flex items-center gap-3">
          Account Settings
        </h1>
        <p className="text-dark-500 dark:text-dark-400 mt-2 font-medium">Manage your personal information, security preferences, and biometric data.</p>
      </motion.div>

      {renderTabs()}

      <AnimatePresence mode="wait">
        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-card p-8"
          >
            <div className="flex flex-col md:flex-row gap-10">
              {/* Avatar Section */}
              <div className="flex flex-col items-center space-y-4 md:w-1/3">
                <div className="w-32 h-32 rounded-full bg-brand-indigo/10 flex items-center justify-center text-brand-indigo text-4xl font-extrabold shadow-sm border-4 border-white dark:border-[#0B1120]">
                  {user?.full_name?.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-dark-900 dark:text-white">{user?.full_name}</p>
                  <p className="text-sm font-semibold text-brand-indigo dark:text-brand-cyan uppercase tracking-widest mt-1">{user?.role?.name?.replace('_', ' ')}</p>
                </div>
              </div>

              {/* Form Section */}
              <div className="flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">IC Number (ID)</label>
                    <input
                      type="text"
                      value={user?.ic_number || ''}
                      disabled
                      className="w-full px-4 py-3 bg-dark-100 dark:bg-dark-900/50 border border-dark-200 dark:border-white/5 rounded-xl text-dark-500 cursor-not-allowed shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-dark-100 dark:border-white/10 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="btn-primary"
                  >
                    {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="glass-card p-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand-cyan/10 rounded-2xl text-brand-cyan">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-dark-900 dark:text-white">Password & Authentication</h3>
                  <p className="text-sm text-dark-500 dark:text-dark-300 mt-1 mb-6">Manage your password and security preferences.</p>
                  
                  <button onClick={() => toast('Password change logic requires OTP as implemented previously.')} className="px-5 py-2.5 bg-dark-50 dark:bg-white/5 hover:bg-dark-100 dark:hover:bg-white/10 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white font-medium rounded-xl transition-all shadow-sm flex items-center gap-2">
                    Change Password <ChevronRight className="w-4 h-4 text-dark-400" />
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card p-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand-indigo/10 rounded-2xl text-brand-indigo">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-dark-900 dark:text-white">Two-Factor Authentication (2FA)</h3>
                      <p className="text-sm text-dark-500 dark:text-dark-300 mt-1">Add an extra layer of security to your account.</p>
                    </div>
                    {/* Mock Toggle */}
                    <div className="w-12 h-6 bg-dark-200 dark:bg-dark-700 rounded-full relative cursor-pointer opacity-50" title="Coming Soon">
                      <div className="w-5 h-5 bg-white dark:bg-dark-400 rounded-full absolute left-0.5 top-0.5 shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'face' && (
          <motion.div
            key="face"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            {/* Render Face Registration Page internally */}
            <div className="-mx-4 sm:mx-0">
              <FaceRegistrationPage />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
