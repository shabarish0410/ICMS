'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { Sun, Moon, Monitor, User, Shield, Bell, Palette } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

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
            <input type="text" defaultValue={user?.full_name} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Email</label>
            <input type="email" defaultValue={user?.email} className="input-field" disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Phone</label>
            <input type="text" defaultValue={user?.mobile || ''} placeholder="+91 9876543210" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Role</label>
            <input type="text" defaultValue={user?.role?.name?.replace('_', ' ')} className="input-field capitalize" disabled />
          </div>
        </div>
        <button className="btn-primary mt-2">Save Changes</button>
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
        <div>
          <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">Current Password</label>
          <input type="password" placeholder="••••••••" className="input-field max-w-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-600 dark:text-dark-300 mb-1">New Password</label>
          <input type="password" placeholder="••••••••" className="input-field max-w-sm" />
        </div>
        <button className="btn-secondary">Change Password</button>
      </div>
    </motion.div>
  );
}
